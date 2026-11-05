// Standalone on-device paper engine: persistence, quote refresh, ORB scans,
// entries/exits, local alerts and the snapshot consumed by the native screens.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOCAL_CONFIG,
  appendActivity,
  buildAlertCandidates,
  computeMetrics,
  createLocalState,
  ensureSession,
  entryExecutionCheck,
  getMarketClock,
  getMarketSchedule,
  manageExits,
  markToMarket,
  mergeAlerts,
  normalizeConfig,
  openPosition,
  recordEquity,
  scanIsDue,
  type LocalAlert,
  type LocalConfig,
  type LocalState,
  type LocalScanResult,
} from './ledger';
import { evaluateOpeningRange, fetchCharts, type ParsedChart } from './market';
import type { Snapshot } from '../types';

export const LOCAL_STORAGE_KEY = 'paper212.local.engine.v1';
const QUOTE_REFRESH_MS = 8_000;

interface StoredEngine {
  version: number;
  config: LocalConfig;
  state: LocalState;
  alerts: LocalAlert[];
}

let loaded = false;
let loadPromise: Promise<void> | null = null;
let config: LocalConfig = normalizeConfig(DEFAULT_LOCAL_CONFIG);
let state: LocalState = createLocalState(config, new Date());
let alerts: LocalAlert[] = [];
let nextRunAt: string | null = null;
let lastSkip: string | null = null;
let inFlight: Promise<Snapshot> | null = null;
let lastQuoteAt = 0;
let saveQueue: Promise<void> = Promise.resolve();

function validState(value: unknown): value is LocalState {
  const candidate = value as LocalState | null;
  return Boolean(
    candidate &&
      candidate.version === 1 &&
      Number.isFinite(Number(candidate.cash)) &&
      Number.isFinite(Number(candidate.startingCash)) &&
      candidate.positions &&
      typeof candidate.positions === 'object' &&
      Array.isArray(candidate.trades) &&
      Array.isArray(candidate.equityHistory)
  );
}

async function ensureLoaded() {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as StoredEngine;
        if (saved && saved.version === 1) {
          config = normalizeConfig(saved.config);
          if (validState(saved.state)) {
            state = saved.state;
            state.activity = Array.isArray(state.activity) ? state.activity : [];
            state.lastQuotes = state.lastQuotes && typeof state.lastQuotes === 'object' ? state.lastQuotes : {};
            state.seq = Number(state.seq) || 0;
            state.runs = Number(state.runs) || 0;
          } else {
            state = createLocalState(config, new Date());
          }
          alerts = Array.isArray(saved.alerts) ? saved.alerts : [];
        }
      } catch {
        // A corrupt local ledger should not brick the app. Start a clean one.
        state = createLocalState(config, new Date());
        alerts = [];
      }
    }
    loaded = true;
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

function save() {
  const payload: StoredEngine = { version: 1, config, state, alerts };
  const body = JSON.stringify(payload);
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => AsyncStorage.setItem(LOCAL_STORAGE_KEY, body))
    .catch(() => {});
  return saveQueue;
}

function appendOnce(type: 'error' | 'skip' | 'info', message: string, now: Date, symbol: string | null = null, windowMs = 90_000) {
  const recent = state.activity.find(
    (item) =>
      item.type === type &&
      item.message === message &&
      (item.symbol || null) === (symbol || null) &&
      Math.abs(now.getTime() - new Date(item.at).getTime()) < windowMs
  );
  if (!recent) appendActivity(state, type, message, now, symbol);
}

function quoteMapFromCharts(charts: Map<string, { price: number | null; bars: { c: number }[] }>) {
  const quotes: Record<string, { last: number }> = {};
  for (const [symbol, chart] of charts) {
    const last = Number(chart.price) || Number(chart.bars[chart.bars.length - 1]?.c);
    if (Number.isFinite(last) && last > 0) quotes[symbol] = { last };
  }
  return quotes;
}

function mergeAlertsFromState(now: Date) {
  alerts = mergeAlerts(alerts, buildAlertCandidates(state, now));
}

async function refreshPositionQuotes(
  now: Date,
  symbols: string[]
): Promise<{ quotes: Record<string, { last: number }>; failed: { symbol: string; message: string }[] }> {
  if (!symbols.length) return { quotes: {}, failed: [] };
  if (now.getTime() - lastQuoteAt < QUOTE_REFRESH_MS) return { quotes: {}, failed: [] };
  lastQuoteAt = now.getTime();
  const { charts, errors } = await fetchCharts(symbols, '1m');
  const quotes = quoteMapFromCharts(charts);
  return { quotes, failed: errors };
}

async function scanWatchlist(now: Date, clock: ReturnType<typeof getMarketClock>) {
  const symbols = config.watchlist.slice(0, 12);
  const { charts, errors } = await fetchCharts(symbols, '5m');
  let firstError: string | null = null;
  const metrics = computeMetrics(state, now);
  const results: LocalScanResult[] = [];
  const failures = new Map(errors.map((error) => [error.symbol, error.message]));

  for (const symbol of symbols) {
    const chart = charts.get(symbol);
    if (!chart) {
      const message = failures.get(symbol) || 'Market data unavailable.';
      results.push({ symbol, status: 'error', reason: message, risk: null, orderQty: null });
      firstError = firstError || `${symbol} scan: ${message}`;
      appendOnce('error', `${symbol} scan: ${message}`, now, symbol);
      continue;
    }
    const result = evaluateSymbol(symbol, chart, now, metrics);
    results.push(result);
  }

  state.lastScan = { at: now.toISOString(), results };
  for (const result of results) {
    if (result.status === 'triggered') {
      lastSkip = null;
      if (result.risk !== 'PASS' || !result.plan) {
        appendOnce('skip', `${result.symbol} triggered but risk blocked it: ${result.reason}`, now, result.symbol);
        continue;
      }
      if (state.positions[result.symbol]) continue;
      const chart = charts.get(result.symbol);
      const current = Number(chart?.price) || Number(result.currentPrice) || result.plan.entry;
      const fresh = entryExecutionCheck(result.plan, { last: current });
      if (!fresh.ok) {
        appendOnce('skip', `${result.symbol} signal skipped: ${fresh.reason}`, now, result.symbol);
        continue;
      }
      const opened = openPosition(
        state,
        {
          symbol: result.symbol,
          qty: result.plan.qty,
          price: current,
          stop: result.plan.stop,
          target: result.plan.target,
          setup: 'orb',
          plan: {
            entry: result.plan.entry,
            stop: result.plan.stop,
            target: result.plan.target,
            reward_risk: 2,
            flat_by: config.flatBy,
          },
          reason: 'on-device opening-range trigger',
        },
        now,
        config
      );
      if (opened.error) appendOnce('skip', `${result.symbol} signal skipped: ${opened.error}`, now, result.symbol);
    } else if (result.status === 'error') {
      // already recorded above
    } else if (result.status === 'expired') {
      lastSkip = result.reason;
    }
  }

  // The scanner's live meta price is newer than the last 1-minute close and can
  // immediately trigger a stop/target on a fast move.
  const scanQuotes = quoteMapFromCharts(charts);
  if (Object.keys(scanQuotes).length) {
    markToMarket(state, scanQuotes, now);
    manageExits(state, scanQuotes, clock, now, config);
  }
  return firstError;
}

function evaluateSymbol(
  symbol: string,
  chart: ParsedChart,
  now: Date,
  metrics: ReturnType<typeof computeMetrics>
) {
  return evaluateOpeningRange({
    symbol,
    chart,
    now,
    config,
    cash: state.cash,
    equity: metrics.equity,
  });
}

function nextScanAfter(now: Date) {
  const previousScan = state.lastScan ? Date.parse(state.lastScan.at) : 0;
  const next = Number.isFinite(previousScan) && previousScan > 0
    ? Math.max(now.getTime(), previousScan + config.pollSeconds * 1000)
    : now.getTime() + config.pollSeconds * 1000;
  return new Date(next).toISOString();
}

async function runTick(manual: boolean) {
  await ensureLoaded();
  const now = new Date();
  const clock = ensureSession(state, now, config);
  const due = scanIsDue(now, state.lastScan?.at, config.pollSeconds, manual);
  state.runs += 1;
  state.lastRunAt = now.toISOString();

  let hadError = false;
  let lastError = '';
  let scanned = false;
  const symbols = Object.keys(state.positions);

  try {
    const quoteResult = await refreshPositionQuotes(now, symbols);
    for (const failure of quoteResult.failed) {
      hadError = true;
      lastError = `${failure.symbol} quote: ${failure.message}`;
      appendOnce('error', lastError, now, failure.symbol);
    }
    if (Object.keys(quoteResult.quotes).length) {
      markToMarket(state, quoteResult.quotes, now);
      manageExits(state, quoteResult.quotes, clock, now, config);
    }

    if (clock.entryOpen && config.enabled && due) {
      scanned = true;
      const scanError = await scanWatchlist(now, clock);
      if (scanError) {
        hadError = true;
        lastError = scanError;
      }
    } else if (!clock.entryOpen) {
      lastSkip = clock.label;
    }

    if (manual && !clock.entryOpen) {
      appendActivity(state, 'info', `Manual run completed. ${clock.label}.`, now);
    }

    // A successful scan clears the error. Ticks that only poll for positions
    // must not erase a scanner failure before the next actual scan can retry.
    state.lastError = hadError ? lastError : scanned ? null : state.lastError;
    const metrics = recordEquity(state, now);
    state.lastStatus = {
      at: now.toISOString(),
      market: clock.label,
      equity: metrics.equity,
      openPositions: metrics.openPositions,
    };
    nextRunAt = config.enabled ? nextScanAfter(now) : null;
  } catch (error) {
    state.lastError = `On-device engine: ${(error as Error)?.message || 'unexpected failure'}`;
    appendOnce('error', state.lastError, now);
    recordEquity(state, now);
    nextRunAt = new Date(now.getTime() + config.pollSeconds * 1000).toISOString();
  }

  mergeAlertsFromState(now);
  await save();
  return toSnapshot(now);
}

export async function getLocalSnapshot(): Promise<Snapshot> {
  await ensureLoaded();
  if (inFlight) return inFlight;
  inFlight = runTick(false).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function controlLocalEngine(action: 'run' | 'pause' | 'resume'): Promise<Snapshot> {
  await ensureLoaded();
  if (action === 'run') {
    if (inFlight) return inFlight;
    inFlight = runTick(true).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  const now = new Date();
  config.enabled = action === 'resume';
  appendActivity(
    state,
    'info',
    `On-device automation ${action === 'resume' ? 'resumed' : 'paused'} from the app.`,
    now
  );
  nextRunAt = config.enabled ? nextScanAfter(now) : null;
  await save();
  return toSnapshot(now);
}

export async function resetLocalEngine(): Promise<Snapshot> {
  await ensureLoaded();
  const now = new Date();
  state = createLocalState(config, now);
  alerts = [];
  nextRunAt = null;
  lastSkip = null;
  lastQuoteAt = 0;
  await save();
  return toSnapshot(now);
}

export async function localEngineConfig() {
  await ensureLoaded();
  return { ...config };
}

export function localEngineStorageKey() {
  return LOCAL_STORAGE_KEY;
}

function toSnapshot(now = new Date()): Snapshot {
  const metrics = computeMetrics(state, now);
  const clock = getMarketClock(now, config);
  const schedule = getMarketSchedule(now, config);
  const positions = Object.values(state.positions).map((position) => {
    const last = Number(position.last) || Number(position.entry);
    const entry = Number(position.entry);
    const qty = Number(position.qty);
    return {
      symbol: position.symbol,
      qty,
      entry,
      last,
      stop: Number(position.stop),
      target: Number(position.target),
      openedAt: position.openedAt,
      lastAt: position.lastAt,
      maxLoss: Number(position.maxLoss),
      pnl: (last - entry) * qty,
      pnlPct: entry ? ((last - entry) / entry) * 100 : 0,
      stopDistancePct: last ? ((last - Number(position.stop)) / last) * 100 : null,
      targetDistancePct: last ? ((Number(position.target) - last) / last) * 100 : null,
    };
  });
  const closedTrades = state.trades
    .filter((trade) => trade.status === 'closed')
    .slice()
    .sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')))
    .slice(0, 20);

  return {
    ok: true,
    apiVersion: 1,
    snapshotTime: now.toISOString(),
    app: { name: 'Paper212', mode: 'on-device' },
    config: {
      enabled: config.enabled,
      watchlist: [...config.watchlist],
      pollSeconds: config.pollSeconds,
      maxOpenPositions: config.maxOpenPositions,
      maxTradesPerDay: config.maxTradesPerDay,
      maxOrderUsd: config.maxOrderUsd,
      maxLossPerTradeUsd: config.maxLossPerTradeUsd,
      startingCash: config.startingCash,
      noEntriesBefore: config.noEntriesBefore,
      noEntriesAfter: config.noEntriesAfter,
      flatBy: config.flatBy,
    },
    metrics,
    market: clock,
    schedule,
    engine: {
      enabled: config.enabled,
      running: Boolean(inFlight),
      nextRunAt,
      lastSkip,
      bridge: {
        state: state.lastError ? 'error' : 'local',
        up: !state.lastError,
        pending: 0,
        lastError: state.lastError,
      },
      simulation: { active: false },
    },
    positions,
    closedTrades: closedTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      qty: trade.qty,
      entry: trade.entry,
      exit: Number(trade.exit),
      pnl: Number(trade.pnl),
      pnlPct: Number(trade.pnlPct),
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      reason: trade.reason,
    })),
    activity: state.activity.slice(0, 50),
    alerts: alerts.slice(0, 80),
    equityHistory: state.equityHistory.slice(-96).map((point) => ({ at: point.at, equity: point.equity, cash: point.cash })),
    lastScan: state.lastScan
      ? {
          at: state.lastScan.at,
          results: state.lastScan.results.map((result) => ({
            symbol: result.symbol,
            status: result.status,
            reason: result.reason,
            risk: result.risk,
            orderQty: result.orderQty,
          })),
        }
      : null,
    selftest: null,
    lastRunAt: state.lastRunAt,
    lastStatus: state.lastStatus,
    lastError: state.lastError,
    autostart: { installed: false },
  };
}
