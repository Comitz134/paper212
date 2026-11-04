// Yahoo chart reader + on-device opening-range scanner. Pure parsing/evaluation
// is separate from the engine so it can be tested without a phone or network.

import {
  DEFAULT_LOCAL_CONFIG,
  PROXIMITY_PCT,
  getEtParts,
  getMarketClock,
  normalizeConfig,
  type LocalConfig,
  type LocalScanResult,
} from './ledger';

const YAHOO_HOSTS = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com'];
const REQUEST_TIMEOUT_MS = 12_000;
export const BAR_SECONDS = 300;

export interface ChartBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ParsedChart {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  marketTime: number | null;
  bars: ChartBar[];
}

interface YahooResult {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: {
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }[];
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooResult[] | null;
    error?: { description?: string } | null;
  };
}

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseYahooChart(value: unknown, fallbackSymbol = ''): ParsedChart {
  const json = value as YahooChartResponse;
  const result = json?.chart?.result?.[0];
  if (!result) {
    const description = json?.chart?.error?.description;
    throw new Error(description ? `Yahoo: ${description}` : 'Yahoo returned no chart data.');
  }
  const quote = result.indicators?.quote?.[0] || {};
  const timestamp = Array.isArray(result.timestamp) ? result.timestamp : [];
  const bars: ChartBar[] = [];
  for (let index = 0; index < timestamp.length; index += 1) {
    const t = Number(timestamp[index]);
    const o = finite(quote.open?.[index]);
    const h = finite(quote.high?.[index]);
    const l = finite(quote.low?.[index]);
    const c = finite(quote.close?.[index]);
    if (!Number.isFinite(t) || t <= 0 || o === null || h === null || l === null || c === null) continue;
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) continue;
    bars.push({ t, o, h, l, c, v: Number(quote.volume?.[index]) || 0 });
  }
  return {
    symbol: String(result.meta?.symbol || fallbackSymbol || '').toUpperCase(),
    price: finite(result.meta?.regularMarketPrice),
    previousClose: finite(result.meta?.chartPreviousClose),
    marketTime: finite(result.meta?.regularMarketTime),
    bars,
  };
}

export async function fetchYahooChart(symbol: string, interval: '1m' | '5m' = '5m', range = '1d') {
  const ticker = String(symbol || '').trim().toUpperCase().replace(/\./g, '-');
  if (!/^[A-Z0-9.\-]{1,15}$/.test(ticker)) throw new Error(`Invalid market symbol: ${symbol}`);
  let lastError: Error | null = null;
  for (const host of YAHOO_HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${host}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`,
        {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        lastError = new Error(
          response.status === 429 ? 'Yahoo is rate-limiting market data.' : `Yahoo returned HTTP ${response.status}.`
        );
        continue;
      }
      return parseYahooChart(await response.json(), ticker);
    } catch (error) {
      const message = (error as Error)?.name === 'AbortError' ? 'Market data request timed out.' : (error as Error)?.message;
      lastError = new Error(message || 'Could not reach Yahoo market data.');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError?.message || 'Could not reach Yahoo market data.');
}

export async function fetchCharts(symbols: string[], interval: '1m' | '5m' = '5m') {
  const unique = [...new Set(symbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))];
  const settled = await Promise.allSettled(unique.map((symbol) => fetchYahooChart(symbol, interval)));
  const charts = new Map<string, ParsedChart>();
  const errors: { symbol: string; message: string }[] = [];
  settled.forEach((item, index) => {
    if (item.status === 'fulfilled') charts.set(unique[index], item.value);
    else errors.push({ symbol: unique[index], message: item.reason?.message || 'Market data unavailable.' });
  });
  return { charts, errors };
}

function minutesInEt(timestamp: number) {
  const et = getEtParts(new Date(timestamp * 1000));
  return et.minutes;
}

function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function floorCents(value: number) {
  return Math.floor((value + Number.EPSILON) * 100) / 100;
}

function sizeEntryPlan({
  entry,
  stop,
  config,
  cash,
  equity,
}: {
  entry: number;
  stop: number;
  config: LocalConfig;
  cash: number;
  equity: number;
}) {
  const riskPerShare = roundCents(entry - stop);
  const riskPct = entry > 0 ? (riskPerShare / entry) * 100 : 0;
  const target = roundCents(entry + riskPerShare * 2);
  if (riskPerShare < 0.01 || riskPct < 0.05 || stop >= entry || target <= entry) {
    return {
      target,
      qty: 0,
      maxLoss: 0,
      riskPerShare,
      riskPct,
      risk: 'BLOCK',
      reason: `risk ${riskPct.toFixed(2)}% is too tight for the 2R plan`,
    };
  }
  const byRisk = Math.floor(config.maxLossPerTradeUsd / riskPerShare);
  const byOrder = Math.floor(config.maxOrderUsd / entry);
  const byCash = Math.floor(cash / entry);
  const byPosition = Math.floor((equity * config.maxPositionPct) / 100 / entry);
  const qty = Math.max(0, Math.min(byRisk, byOrder, byCash, byPosition));
  const maxLoss = qty * riskPerShare;
  if (qty < 1) {
    return {
      target,
      qty,
      maxLoss,
      riskPerShare,
      riskPct,
      risk: 'BLOCK',
      reason: 'no whole share fits the cash, position, order and loss caps',
    };
  }
  return { target, qty, maxLoss, riskPerShare, riskPct, risk: 'PASS', reason: '' };
}

export function evaluateOpeningRange({
  symbol,
  chart,
  now = new Date(),
  config: configInput = DEFAULT_LOCAL_CONFIG,
  cash = DEFAULT_LOCAL_CONFIG.startingCash,
  equity = DEFAULT_LOCAL_CONFIG.startingCash,
}: {
  symbol: string;
  chart: ParsedChart;
  now?: Date;
  config?: LocalConfig;
  cash?: number;
  equity?: number;
}): LocalScanResult {
  const config = normalizeConfig(configInput);
  const ticker = String(symbol || chart.symbol || '').trim().toUpperCase();
  const clock = getMarketClock(now, config);
  const et = getEtParts(now);
  const today = et.dateKey;
  const nowSeconds = now.getTime() / 1000;

  if (!clock.weekdayOpen) {
    const reason = clock.holiday ? `the NYSE is closed today (${clock.holiday})` : 'the NYSE is closed for the weekend';
    return { symbol: ticker, status: 'no-data', reason, risk: null, orderQty: null };
  }
  if (et.minutes < 570) {
    return {
      symbol: ticker,
      status: 'waiting',
      reason: 'the NYSE opens at 9:30 ET and the 15-minute range is set at 9:45',
      risk: null,
      orderQty: null,
    };
  }

  const cutoffShift = 960 - clock.closeMinutes;
  const cutoffMinutes = Math.min(
    clock.closeMinutes,
    Number(config.noEntriesAfter.slice(0, 2)) * 60 + Number(config.noEntriesAfter.slice(3, 2)) - cutoffShift
  );
  const cutoff = `${String(Math.floor(cutoffMinutes / 60)).padStart(2, '0')}:${String(cutoffMinutes % 60).padStart(2, '0')}`;
  const bySlot = new Map<number, ChartBar & { end: number; slot: number }>();
  for (const bar of chart.bars) {
    if (bar.t % BAR_SECONDS !== 0) continue;
    const barEt = getEtParts(new Date(bar.t * 1000));
    if (barEt.dateKey !== today) continue;
    if (barEt.minutes < 570 || barEt.minutes >= clock.closeMinutes) continue;
    const end = bar.t + BAR_SECONDS;
    if (end > nowSeconds) continue;
    const slot = Math.floor((barEt.minutes - 570) / 5);
    bySlot.set(slot, { ...bar, end, slot });
  }
  const bars = [...bySlot.values()].sort((a, b) => a.t - b.t);
  const last = bars[bars.length - 1] || null;
  const price = Number(chart.price) || last?.c || null;
  const rangeBars = bars.filter((bar) => bar.slot < 3);
  if (et.minutes < 585) {
    return {
      symbol: ticker,
      status: 'waiting',
      reason: `${rangeBars.length} of 3 range bars closed; the range is set at 9:45`,
      risk: null,
      orderQty: null,
      currentPrice: price,
    };
  }
  if (rangeBars.length < 3) {
    return {
      symbol: ticker,
      status: 'no-data',
      reason: 'Yahoo has not sent all three opening-range bars yet',
      risk: null,
      orderQty: null,
      currentPrice: price,
    };
  }
  const rangeHigh = Math.max(...rangeBars.map((bar) => bar.h));
  const rangeLow = Math.min(...rangeBars.map((bar) => bar.l));
  const mid = (rangeHigh + rangeLow) / 2;
  let trigger: (ChartBar & { end: number; slot: number }) | null = null;
  for (const bar of bars) {
    if (bar.slot < 3) continue;
    if (minutesInEt(bar.end) < 585) continue;
    if (minutesInEt(bar.end) > cutoffMinutes) break;
    if (bar.c > rangeHigh) {
      trigger = bar;
      break;
    }
  }
  if (!trigger) {
    if (et.minutes >= cutoffMinutes) {
      return {
        symbol: ticker,
        status: 'expired',
        reason: `no completed 5-minute bar closed above the range high $${rangeHigh.toFixed(2)} by ${cutoff}, the last time for a new entry`,
        risk: null,
        orderQty: null,
        currentPrice: price,
      };
    }
    const lastClose = last?.c ?? 0;
    const gap = rangeHigh - lastClose;
    return {
      symbol: ticker,
      status: 'waiting',
      reason: last
        ? `last close $${lastClose.toFixed(2)} (${new Date(last.t * 1000).toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            minute: '2-digit',
          })} ET), $${Math.abs(gap).toFixed(2)} ${gap >= 0 ? 'under' : 'over'} the range high $${rangeHigh.toFixed(2)}`
        : 'Yahoo has not sent completed opening-range bars yet',
      risk: null,
      orderQty: null,
      currentPrice: price,
    };
  }

  const entry = roundCents(trigger.c);
  const stop = floorCents(mid);
  const sized = sizeEntryPlan({ entry, stop, config, cash, equity });
  const triggerAt = new Date(trigger.end * 1000).toISOString();
  const plan = {
    entry,
    stop,
    target: sized.target,
    rangeHigh: roundCents(rangeHigh),
    rangeLow: roundCents(rangeLow),
    triggerAt,
    triggerPrice: entry,
    riskPerShare: sized.riskPerShare,
    riskPct: sized.riskPct,
    qty: sized.qty,
    maxLoss: sized.maxLoss,
    setup: 'orb' as const,
    flatBy: config.flatBy,
  };
  const triggerEt = getEtParts(new Date(trigger.t * 1000));
  return {
    symbol: ticker,
    status: 'triggered',
    reason: `the ${triggerEt.hour}:${String(triggerEt.minute).padStart(2, '0')} bar closed above the range high $${rangeHigh.toFixed(2)}`,
    risk: sized.risk,
    orderQty: sized.risk === 'PASS' ? sized.qty : null,
    plan,
    currentPrice: price,
  };
}

export function proximityForPosition(position: { last: number; stop: number; target: number }) {
  const last = Number(position.last);
  return {
    stopDistancePct: last ? ((last - Number(position.stop)) / last) * 100 : null,
    targetDistancePct: last ? ((Number(position.target) - last) / last) * 100 : null,
    nearStop: Number.isFinite(last) && last > position.stop && ((last - position.stop) / last) * 100 <= PROXIMITY_PCT,
    nearTarget:
      Number.isFinite(last) && last < position.target && ((position.target - last) / last) * 100 <= PROXIMITY_PCT,
  };
}
