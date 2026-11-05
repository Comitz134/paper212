// Pure on-device paper ledger. No server, network or React Native imports.

export const LOCAL_STATE_VERSION = 1;
export const PROXIMITY_PCT = 0.35;
export const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/;

export interface LocalConfig {
  enabled: boolean;
  watchlist: string[];
  startingCash: number;
  pollSeconds: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  maxDailyLossUsd: number;
  maxLossPerTradeUsd: number;
  maxOrderUsd: number;
  maxPositionPct: number;
  noEntriesBefore: string;
  noEntriesAfter: string;
  flatBy: string;
}

export const DEFAULT_LOCAL_CONFIG: LocalConfig = Object.freeze({
  enabled: true,
  watchlist: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'SPY'],
  startingCash: 100000,
  pollSeconds: 180,
  maxOpenPositions: 3,
  maxTradesPerDay: 3,
  maxDailyLossUsd: 3000,
  maxLossPerTradeUsd: 1000,
  maxOrderUsd: 10000,
  maxPositionPct: 10,
  noEntriesBefore: '09:45',
  noEntriesAfter: '15:30',
  flatBy: '15:55',
});

const ET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const NYSE_HOLIDAYS: Record<string, string> = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King, Jr. Day',
  '2026-02-16': "Washington's Birthday",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth National Independence Day',
  '2026-07-03': 'Independence Day (observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King, Jr. Day',
  '2027-02-15': "Washington's Birthday",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth National Independence Day (observed)',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving Day',
  '2027-12-24': 'Christmas Day (observed)',
};

const NYSE_EARLY_CLOSE: Record<string, string> = {
  '2026-11-27': 'day after Thanksgiving',
  '2026-12-24': 'Christmas Eve',
  '2027-11-26': 'day after Thanksgiving',
};

export interface EtParts {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: number;
  minute: number;
  minutes: number;
  dateKey: string;
  label: string;
}

export interface MarketClock extends EtParts {
  weekdayOpen: boolean;
  open: boolean;
  entryOpen: boolean;
  flat: boolean;
  holiday: string | null;
  earlyClose: string | null;
  closeMinutes: number;
  phase: string;
  label: string;
}

export interface MarketSchedule {
  phase: string;
  phaseLabel: string;
  entryOpen: boolean;
  entryStart: string;
  entryEnd: string;
  entryStartAt: string | null;
  entryEndAt: string | null;
  nextChangeAt: string | null;
  nextChangeLabel: string;
  secondsToNextChange: number | null;
}

export interface EntryPlan {
  entry: number;
  stop: number;
  target: number;
  rangeHigh: number;
  rangeLow: number;
  triggerAt: string;
  triggerPrice: number;
  riskPerShare: number;
  riskPct: number;
  qty: number;
  maxLoss: number;
  setup: 'orb';
  flatBy: string;
}

export interface LocalScanResult {
  symbol: string;
  status: 'triggered' | 'waiting' | 'expired' | 'no-data' | 'error';
  reason: string;
  risk: string | null;
  orderQty: number | null;
  plan?: EntryPlan;
  currentPrice?: number | null;
}

export interface LocalPlan {
  entry: number;
  stop: number;
  target: number;
  reward_risk: number;
  flat_by: string;
}

export interface LocalPosition {
  id: string;
  symbol: string;
  qty: number;
  entry: number;
  last: number;
  stop: number;
  target: number;
  setup: string;
  plan: LocalPlan | null;
  openedAt: string;
  lastAt: string;
  maxLoss: number;
}

export interface LocalTrade {
  id: string;
  symbol: string;
  side: 'buy';
  qty: number;
  entry: number;
  exit: number | null;
  stop: number;
  target: number;
  setup: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  pnl: number | null;
  pnlPct: number | null;
  reason: string | null;
}

export type LocalActivityKind = 'trade' | 'win' | 'loss' | 'error' | 'skip' | 'info';

export interface LocalActivity {
  id: string;
  at: string;
  type: LocalActivityKind;
  message: string;
  symbol?: string | null;
  test?: boolean;
}

export interface LocalState {
  version: number;
  createdAt: string;
  startingCash: number;
  cash: number;
  positions: Record<string, LocalPosition>;
  trades: LocalTrade[];
  activity: LocalActivity[];
  equityHistory: {
    at: string;
    equity: number;
    cash: number;
    realized: number;
    unrealized: number;
    totalPnl: number;
    openPositions: number;
  }[];
  dayKey: string;
  dayStartEquity: number;
  dayStartRealized: number;
  runs: number;
  seq: number;
  lastRunAt: string | null;
  lastError: string | null;
  lastScan: { at: string; results: LocalScanResult[] } | null;
  lastQuotes: Record<string, { last: number; at: string }>;
  lastStatus: { at: string; market: string; equity: number; openPositions: number } | null;
}

export interface Metrics {
  startingCash: number;
  cash: number;
  equity: number;
  realized: number;
  unrealized: number;
  totalPnl: number;
  returnPct: number;
  todayPnl: number;
  dailyRealized: number;
  openPositions: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
}

export type AlertCategory = 'signal' | 'fill' | 'exit' | 'stop' | 'target' | 'error';

export interface LocalAlert {
  id: string;
  key: string;
  at: string;
  category: AlertCategory;
  symbol: string | null;
  title: string;
  message: string;
  data: Record<string, string | number | boolean | null>;
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

function clockMinutes(value: string, fallback: number) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function normalizeConfig(raw: Partial<LocalConfig> | null | undefined): LocalConfig {
  const source = raw && typeof raw === 'object' ? raw : {};
  const watchlist = [...new Set(
    (Array.isArray(source.watchlist) ? source.watchlist : DEFAULT_LOCAL_CONFIG.watchlist)
      .map((symbol) => String(symbol || '').trim().toUpperCase())
      .filter((symbol) => TICKER_RE.test(symbol))
  )].slice(0, 12);

  return {
    enabled: source.enabled !== false,
    watchlist: watchlist.length ? watchlist : [...DEFAULT_LOCAL_CONFIG.watchlist],
    startingCash: clamp(source.startingCash, 1000, 1_000_000_000, DEFAULT_LOCAL_CONFIG.startingCash),
    pollSeconds: Math.round(clamp(source.pollSeconds, 30, 3600, DEFAULT_LOCAL_CONFIG.pollSeconds)),
    maxOpenPositions: Math.round(clamp(source.maxOpenPositions, 1, 20, DEFAULT_LOCAL_CONFIG.maxOpenPositions)),
    maxTradesPerDay: Math.round(clamp(source.maxTradesPerDay, 1, 50, DEFAULT_LOCAL_CONFIG.maxTradesPerDay)),
    maxDailyLossUsd: clamp(source.maxDailyLossUsd, 1, 1_000_000, DEFAULT_LOCAL_CONFIG.maxDailyLossUsd),
    maxLossPerTradeUsd: clamp(source.maxLossPerTradeUsd, 1, 1_000_000, DEFAULT_LOCAL_CONFIG.maxLossPerTradeUsd),
    maxOrderUsd: clamp(source.maxOrderUsd, 1, 1_000_000, DEFAULT_LOCAL_CONFIG.maxOrderUsd),
    maxPositionPct: clamp(source.maxPositionPct, 1, 100, DEFAULT_LOCAL_CONFIG.maxPositionPct),
    noEntriesBefore: /^\d{2}:\d{2}$/.test(source.noEntriesBefore || '')
      ? source.noEntriesBefore!
      : DEFAULT_LOCAL_CONFIG.noEntriesBefore,
    noEntriesAfter: /^\d{2}:\d{2}$/.test(source.noEntriesAfter || '')
      ? source.noEntriesAfter!
      : DEFAULT_LOCAL_CONFIG.noEntriesAfter,
    flatBy: /^\d{2}:\d{2}$/.test(source.flatBy || '') ? source.flatBy! : DEFAULT_LOCAL_CONFIG.flatBy,
  };
}

export function scanIsDue(
  now: Date | string | number,
  lastScanAt: string | null | undefined,
  pollSeconds: number,
  manual = false
): boolean {
  if (manual) return true;
  const date = now instanceof Date ? now : new Date(now);
  const previous = lastScanAt ? Date.parse(lastScanAt) : 0;
  if (!Number.isFinite(previous) || previous <= 0) return true;
  const interval = Math.max(1, Number(pollSeconds) || 0) * 1000;
  return date.getTime() - previous >= interval;
}

export function getEtParts(now: Date | string | number = new Date()): EtParts {
  const date = now instanceof Date ? now : new Date(now);
  const values: Record<string, string> = {};
  for (const part of ET_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  const hour = Number(values.hour || 0);
  const minute = Number(values.minute || 0);
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    weekday: values.weekday,
    hour,
    minute,
    minutes: hour * 60 + minute,
    dateKey: `${values.year}-${values.month}-${values.day}`,
    label: `${values.weekday} ${values.year}-${values.month}-${values.day} ${String(hour).padStart(2, '0')}:${String(
      minute
    ).padStart(2, '0')} ET`,
  };
}

function holidayFor(dateKey: string) {
  return NYSE_HOLIDAYS[dateKey] || null;
}

function sessionBounds(now: Date, config: LocalConfig) {
  const et = getEtParts(now);
  const holiday = holidayFor(et.dateKey);
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(et.weekday);
  const tradingDay = weekday && !holiday;
  const earlyClose = tradingDay ? NYSE_EARLY_CLOSE[et.dateKey] || null : null;
  const closeMinutes = earlyClose ? 780 : 960;
  const shift = 960 - closeMinutes;
  const entryStart = Math.min(clockMinutes(config.noEntriesBefore, 585), closeMinutes);
  const configuredEntryEnd = clockMinutes(config.noEntriesAfter, 930);
  const entryEnd = Math.max(entryStart, configuredEntryEnd - shift);
  const configuredFlat = clockMinutes(config.flatBy, 955);
  const flatBy = Math.max(entryEnd, configuredFlat - shift);
  return { et, holiday, weekday, tradingDay, earlyClose, closeMinutes, entryStart, entryEnd, flatBy };
}

export function getMarketClock(now: Date | string | number = new Date(), configInput: LocalConfig = DEFAULT_LOCAL_CONFIG): MarketClock {
  const date = now instanceof Date ? now : new Date(now);
  const config = normalizeConfig(configInput);
  const { et, holiday, tradingDay, earlyClose, closeMinutes, entryStart, entryEnd, flatBy } = sessionBounds(date, config);
  const marketOpen = tradingDay && et.minutes >= 570 && et.minutes < closeMinutes;
  const flat = tradingDay && et.minutes >= flatBy;
  const phase = !tradingDay
    ? 'weekend'
    : et.minutes < 570
      ? 'preopen'
      : et.minutes < entryStart
        ? 'opening'
        : et.minutes <= entryEnd
          ? 'entry'
          : et.minutes < flatBy
            ? 'late'
            : et.minutes < closeMinutes
              ? 'flat'
              : 'closed';
  const label = !tradingDay
    ? `Market closed${holiday ? ` · ${holiday}` : ' · weekend'}`
    : et.minutes < 570
      ? `Pre-open · entries start ${hm(entryStart)} ET`
      : et.minutes < entryStart
        ? `Opening range · entries start ${hm(entryStart)} ET`
        : et.minutes <= entryEnd
          ? `Market open · entries until ${hm(entryEnd)} ET${earlyClose ? ` · early close ${hm(closeMinutes)} ET` : ''}`
          : et.minutes < flatBy
            ? `Entries closed · flat by ${hm(flatBy)} ET`
            : et.minutes < closeMinutes
              ? `Flat-by window · ${hm(flatBy)} ET`
              : 'Market closed';

  return {
    ...et,
    weekdayOpen: tradingDay,
    open: marketOpen,
    entryOpen: tradingDay && marketOpen && et.minutes >= entryStart && et.minutes <= entryEnd,
    flat,
    holiday,
    earlyClose,
    closeMinutes,
    phase,
    label,
  };
}

export function parseEtDateTime(value: string | null | undefined): Date | null {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let index = 0; index < 5; index += 1) {
    const parts = getEtParts(new Date(guess));
    const actual = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), parts.hour, parts.minute);
    const delta = desired - actual;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

export function formatEtDateTime(value: Date | string | number) {
  const parts = getEtParts(value);
  return `${parts.year}-${parts.month}-${parts.day} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function nextTradingDayKey(dateKey: string) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  for (let offset = 1; offset <= 10; offset += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day + offset));
    const key = `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, '0')}-${String(
      candidate.getUTCDate()
    ).padStart(2, '0')}`;
    const weekday = candidate.getUTCDay();
    if (weekday >= 1 && weekday <= 5 && !holidayFor(key)) return key;
  }
  return dateKey;
}

export function getMarketSchedule(now: Date | string | number = new Date(), configInput: LocalConfig = DEFAULT_LOCAL_CONFIG): MarketSchedule {
  const config = normalizeConfig(configInput);
  const date = now instanceof Date ? now : new Date(now);
  const clock = getMarketClock(date, config);
  const { et, entryStart, entryEnd } = sessionBounds(date, config);

  let targetKey = et.dateKey;
  let targetMinutes = entryStart;
  let nextChangeLabel = 'Next entry window';
  if (clock.entryOpen) {
    targetMinutes = entryEnd;
    nextChangeLabel = 'Entries close';
  } else if (!(clock.weekdayOpen && et.minutes < entryStart)) {
    targetKey = nextTradingDayKey(et.dateKey);
    targetMinutes = entryStart;
  }
  const nextChangeAt = parseEtDateTime(`${targetKey} ${hm(targetMinutes)}`);
  const entryStartAt = parseEtDateTime(`${et.dateKey} ${hm(entryStart)}`);
  const entryEndAt = parseEtDateTime(`${et.dateKey} ${hm(entryEnd)}`);

  return {
    phase: clock.phase,
    phaseLabel: clock.label,
    entryOpen: clock.entryOpen,
    entryStart: hm(entryStart),
    entryEnd: hm(entryEnd),
    entryStartAt: entryStartAt ? entryStartAt.toISOString() : null,
    entryEndAt: entryEndAt ? entryEndAt.toISOString() : null,
    nextChangeAt: nextChangeAt ? nextChangeAt.toISOString() : null,
    nextChangeLabel,
    secondsToNextChange: nextChangeAt ? Math.max(0, Math.round((nextChangeAt.getTime() - date.getTime()) / 1000)) : null,
  };
}

export function createLocalState(configInput: LocalConfig = DEFAULT_LOCAL_CONFIG, now = new Date()): LocalState {
  const config = normalizeConfig(configInput);
  const clock = getMarketClock(now, config);
  return {
    version: LOCAL_STATE_VERSION,
    createdAt: now.toISOString(),
    startingCash: config.startingCash,
    cash: config.startingCash,
    positions: {},
    trades: [],
    activity: [
      {
        id: `evt_${now.getTime().toString(36)}_1`,
        at: now.toISOString(),
        type: 'info',
        message: 'On-device paper ledger created. No PC, server or broker is connected.',
      },
    ],
    equityHistory: [
      {
        at: now.toISOString(),
        equity: config.startingCash,
        cash: config.startingCash,
        realized: 0,
        unrealized: 0,
        totalPnl: 0,
        openPositions: 0,
      },
    ],
    dayKey: clock.dateKey,
    dayStartEquity: config.startingCash,
    dayStartRealized: 0,
    runs: 0,
    seq: 2,
    lastRunAt: null,
    lastError: null,
    lastScan: null,
    lastQuotes: {},
    lastStatus: null,
  };
}

function nextId(state: LocalState, prefix: string) {
  state.seq = (Number(state.seq) || 0) + 1;
  return `${prefix}_${Date.now().toString(36)}_${state.seq.toString(36)}`;
}

export function appendActivity(
  state: LocalState,
  type: LocalActivityKind,
  message: string,
  now = new Date(),
  symbol: string | null = null
) {
  const item: LocalActivity = {
    id: nextId(state, 'evt'),
    at: now.toISOString(),
    type,
    message: String(message || ''),
    ...(symbol ? { symbol } : {}),
  };
  state.activity.unshift(item);
  if (state.activity.length > 120) state.activity.length = 120;
  return item;
}

export function ensureSession(state: LocalState, now: Date, config: LocalConfig) {
  const clock = getMarketClock(now, config);
  if (state.dayKey !== clock.dateKey) {
    state.dayKey = clock.dateKey;
    const metrics = computeMetrics(state, now);
    state.dayStartEquity = metrics.equity;
    state.dayStartRealized = metrics.realized;
    appendActivity(state, 'info', `New ET session ${clock.dateKey}. Daily P&L baseline reset.`, now);
  }
  return clock;
}

export function markToMarket(state: LocalState, quotes: Record<string, { last?: number }> = {}, now = new Date()) {
  for (const position of Object.values(state.positions)) {
    const last = Number(quotes[position.symbol]?.last);
    if (Number.isFinite(last) && last > 0) {
      position.last = last;
      position.lastAt = now.toISOString();
      state.lastQuotes[position.symbol] = { last, at: now.toISOString() };
    }
  }
}

export function computeMetrics(state: LocalState, now: Date | string | number = new Date()): Metrics {
  const closed = (state.trades || []).filter((trade) => trade.status === 'closed');
  const realized = closed.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  let unrealized = 0;
  let positionValue = 0;
  for (const position of Object.values(state.positions || {})) {
    const mark = Number(position.last) || Number(position.entry) || 0;
    positionValue += Number(position.qty) * mark;
    unrealized += Number(position.qty) * (mark - Number(position.entry));
  }
  const equity = Number(state.cash) + positionValue;
  const wins = closed.filter((trade) => Number(trade.pnl) > 0).length;
  const losses = closed.filter((trade) => Number(trade.pnl) < 0).length;
  const today = getEtParts(now).dateKey;
  const todayClosed = closed.filter((trade) => trade.closedAt && getEtParts(trade.closedAt).dateKey === today);
  const dailyRealized = todayClosed.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  return {
    startingCash: Number(state.startingCash) || 0,
    cash: Number(state.cash) || 0,
    equity,
    realized,
    unrealized,
    totalPnl: equity - (Number(state.startingCash) || 0),
    returnPct: Number(state.startingCash) > 0 ? ((equity - Number(state.startingCash)) / Number(state.startingCash)) * 100 : 0,
    todayPnl: equity - (Number(state.dayStartEquity) || Number(state.startingCash) || 0),
    dailyRealized,
    openPositions: Object.keys(state.positions || {}).length,
    closedTrades: closed.length,
    wins,
    losses,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
  };
}

export function recordEquity(state: LocalState, now = new Date()) {
  const metrics = computeMetrics(state, now);
  state.equityHistory.push({
    at: now.toISOString(),
    equity: metrics.equity,
    cash: metrics.cash,
    realized: metrics.realized,
    unrealized: metrics.unrealized,
    totalPnl: metrics.totalPnl,
    openPositions: metrics.openPositions,
  });
  if (state.equityHistory.length > 2880) state.equityHistory.splice(0, state.equityHistory.length - 2880);
  return metrics;
}

export function openPosition(
  state: LocalState,
  {
    symbol,
    qty,
    price,
    stop,
    target,
    setup = 'orb',
    plan = null,
    reason = '',
  }: {
    symbol: string;
    qty: number;
    price: number;
    stop: number;
    target: number;
    setup?: string;
    plan?: LocalPlan | null;
    reason?: string;
  },
  now = new Date(),
  configInput: LocalConfig = DEFAULT_LOCAL_CONFIG
) {
  const config = normalizeConfig(configInput);
  const clock = getMarketClock(now, config);
  const ticker = String(symbol || '').toUpperCase();
  const quantity = Number(qty);
  const fill = Number(price);
  const stopPrice = Number(stop);
  const targetPrice = Number(target);

  if (!TICKER_RE.test(ticker) || !Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'Invalid automation order size.' };
  }
  if (!Number.isFinite(fill) || fill <= 0 || !Number.isFinite(stopPrice) || stopPrice <= 0 || !Number.isFinite(targetPrice)) {
    return { error: 'Invalid automation fill, stop or target.' };
  }
  if (stopPrice >= fill) return { error: 'Long stop must be below the fill price.' };
  if (targetPrice <= fill) return { error: 'Target must be above the fill price.' };
  if (state.positions[ticker]) return { error: `Already holding ${ticker}.` };
  if (Object.keys(state.positions).length >= config.maxOpenPositions) {
    return { error: `Max ${config.maxOpenPositions} open positions.` };
  }

  const today = clock.dateKey;
  const openedToday = (state.trades || []).filter((trade) => trade.openedAt && getEtParts(trade.openedAt).dateKey === today).length;
  if (openedToday >= config.maxTradesPerDay) return { error: `Max ${config.maxTradesPerDay} trades today.` };

  const metrics = computeMetrics(state, now);
  const dailyClosed = (state.trades || [])
    .filter((trade) => trade.status === 'closed' && trade.closedAt && getEtParts(trade.closedAt).dateKey === today)
    .reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  if (dailyClosed <= -config.maxDailyLossUsd) return { error: `Daily loss limit of $${config.maxDailyLossUsd} reached.` };

  const cost = quantity * fill;
  if (cost > state.cash + 1e-9) return { error: 'Not enough automation cash for this trade.' };
  if (cost > config.maxOrderUsd + 1e-9) return { error: `Order exceeds $${config.maxOrderUsd} cap.` };
  const maxLoss = (fill - stopPrice) * quantity;
  if (maxLoss > config.maxLossPerTradeUsd + 1e-9) {
    return { error: `Trade risk $${maxLoss.toFixed(2)} exceeds $${config.maxLossPerTradeUsd} cap.` };
  }
  if (!clock.open || clock.flat) return { error: 'Market is closed or in the flat-by window.' };

  const id = nextId(state, 'trade');
  const openedAt = now.toISOString();
  state.cash -= cost;
  const position: LocalPosition = {
    id,
    symbol: ticker,
    qty: quantity,
    entry: fill,
    stop: stopPrice,
    target: targetPrice,
    setup,
    plan,
    openedAt,
    last: fill,
    lastAt: openedAt,
    maxLoss,
  };
  state.positions[ticker] = position;
  state.trades.push({
    id,
    symbol: ticker,
    side: 'buy',
    qty: quantity,
    entry: fill,
    exit: null,
    stop: stopPrice,
    target: targetPrice,
    setup,
    status: 'open',
    openedAt,
    closedAt: null,
    pnl: null,
    pnlPct: null,
    reason: null,
  });
  appendActivity(
    state,
    'trade',
    `Opened ${quantity} ${ticker} at ${fill.toFixed(2)} · stop ${stopPrice.toFixed(2)} · target ${targetPrice.toFixed(
      2
    )}${reason ? ` · ${reason}` : ''}`,
    now,
    ticker
  );
  appendActivity(state, 'info', `Automation equity after entry: $${metrics.equity.toFixed(2)}.`, now);
  return { position, cost, maxLoss };
}

export function closePosition(state: LocalState, symbol: string, price: number, reason = 'manual', now = new Date()) {
  const ticker = String(symbol || '').toUpperCase();
  const position = state.positions[ticker];
  const fill = Number(price);
  if (!position) return { error: `No open ${ticker} position.` };
  if (!Number.isFinite(fill) || fill <= 0) return { error: 'Invalid exit price.' };

  const proceeds = Number(position.qty) * fill;
  const pnl = (fill - Number(position.entry)) * Number(position.qty);
  const pnlPct = Number(position.entry) > 0 ? ((fill - Number(position.entry)) / Number(position.entry)) * 100 : 0;
  state.cash += proceeds;
  delete state.positions[ticker];

  const trade = (state.trades || []).find((item) => item.id === position.id && item.status === 'open');
  if (trade) {
    trade.status = 'closed';
    trade.exit = fill;
    trade.closedAt = now.toISOString();
    trade.pnl = pnl;
    trade.pnlPct = pnlPct;
    trade.reason = reason;
  }
  appendActivity(
    state,
    pnl >= 0 ? 'win' : 'loss',
    `Closed ${position.qty} ${ticker} at ${fill.toFixed(2)} · ${reason} · P&L $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%).`,
    now,
    ticker
  );
  return { trade, pnl, pnlPct };
}

export function entryExecutionCheck(plan: Pick<EntryPlan, 'entry' | 'stop' | 'target'>, quote: { last?: number }) {
  const entry = Number(plan?.entry);
  const stop = Number(plan?.stop);
  const target = Number(plan?.target);
  const fill = Number(quote?.last);
  if (![entry, stop, target, fill].every((value) => Number.isFinite(value) && value > 0)) {
    return { ok: false, reason: 'No usable live quote for this plan.' };
  }
  if (fill < entry) {
    return { ok: false, reason: `Current price ${fill.toFixed(2)} is below the ${entry.toFixed(2)} trigger; the setup has already failed.` };
  }
  if (fill > entry * 1.01) {
    return { ok: false, reason: `Current price ${fill.toFixed(2)} is more than 1% above the ${entry.toFixed(2)} trigger; not chasing.` };
  }
  if (fill <= stop) return { ok: false, reason: 'Current price is at or below the planned stop.' };
  if (fill >= target) return { ok: false, reason: 'Current price is already at the planned target.' };
  return { ok: true };
}

export function manageExits(
  state: LocalState,
  quotes: Record<string, { last?: number }>,
  clock: MarketClock,
  now = new Date(),
  configInput: LocalConfig = DEFAULT_LOCAL_CONFIG
) {
  const config = normalizeConfig(configInput);
  const closed: ReturnType<typeof closePosition>[] = [];
  for (const position of Object.values(state.positions || {})) {
    const last = Number(quotes?.[position.symbol]?.last) || Number(position.last);
    if (!Number.isFinite(last) || last <= 0) continue;
    if (!clock.open || clock.flat) {
      const result = closePosition(state, position.symbol, last, clock.flat ? 'flat-by close' : 'market closed', now);
      if (!result.error) closed.push(result);
    } else if (last <= Number(position.stop)) {
      const result = closePosition(state, position.symbol, Number(position.stop), 'stop-loss', now);
      if (!result.error) closed.push(result);
    } else if (last >= Number(position.target)) {
      const result = closePosition(state, position.symbol, Number(position.target), 'take-profit', now);
      if (!result.error) closed.push(result);
    }
  }
  return closed;
}

function hash(value: string) {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619);
  }
  return (out >>> 0).toString(16).padStart(8, '0');
}

function alertFor(key: string, at: string, category: AlertCategory, symbol: string | null, title: string, message: string, data: LocalAlert['data']): LocalAlert {
  return { id: `alert_${hash(key)}`, key, at, category, symbol, title, message, data };
}

export function buildAlertCandidates(state: LocalState, now = new Date()): LocalAlert[] {
  const alerts: LocalAlert[] = [];
  for (const trade of state.trades || []) {
    alerts.push(
      alertFor(
        `fill:${trade.id}`,
        trade.openedAt,
        'fill',
        trade.symbol,
        `Paper buy · ${trade.symbol}`,
        `Filled ${trade.qty} ${trade.symbol} at $${Number(trade.entry).toFixed(2)} · stop $${Number(trade.stop).toFixed(
          2
        )} · target $${Number(trade.target).toFixed(2)}.`,
        {
          qty: trade.qty,
          entry: Number(trade.entry),
          stop: Number(trade.stop),
          target: Number(trade.target),
          price: Number(trade.entry),
        }
      )
    );

    if (trade.status !== 'closed' || !trade.closedAt) continue;
    const reason = String(trade.reason || 'exit');
    const category: AlertCategory = reason.includes('stop')
      ? 'stop'
      : reason.includes('target')
        ? 'target'
        : 'exit';
    const label = category === 'stop' ? 'Stop hit' : category === 'target' ? 'Target exit' : 'Paper exit';
    alerts.push(
      alertFor(
        `exit:${trade.id}:${reason}`,
        trade.closedAt,
        category,
        trade.symbol,
        `${label} · ${trade.symbol}`,
        `Sold ${trade.qty} ${trade.symbol} at $${Number(trade.exit).toFixed(2)} · ${reason} · P&L ${
          Number(trade.pnl) >= 0 ? '+' : ''
        }$${Number(trade.pnl).toFixed(2)} (${Number(trade.pnlPct).toFixed(2)}%).`,
        {
          qty: trade.qty,
          entry: Number(trade.entry),
          exit: Number(trade.exit),
          stop: Number(trade.stop),
          target: Number(trade.target),
          pnl: Number(trade.pnl),
          pnlPct: Number(trade.pnlPct),
          reason,
        }
      )
    );
  }

  for (const position of Object.values(state.positions || {})) {
    const last = Number(position.last);
    if (!Number.isFinite(last) || last <= 0) continue;
    const stop = Number(position.stop);
    const target = Number(position.target);
    const stopDistance = last ? ((last - stop) / last) * 100 : null;
    const targetDistance = last ? ((target - last) / last) * 100 : null;
    if (stopDistance !== null && stopDistance <= PROXIMITY_PCT && last > stop) {
      const at = position.lastAt || now.toISOString();
      const key = `near-stop:${position.id}:${stop.toFixed(2)}`;
      alerts.push(
        alertFor(
          key,
          at,
          'stop',
          position.symbol,
          `Near stop · ${position.symbol}`,
          `Last $${last.toFixed(2)} is $${(last - stop).toFixed(2)} (${stopDistance.toFixed(2)}%) above the $${stop.toFixed(
            2
          )} stop.`,
          {
            state: 'near',
            qty: position.qty,
            entry: Number(position.entry),
            last,
            stop,
            distancePct: stopDistance,
          }
        )
      );
    }
    if (targetDistance !== null && targetDistance <= PROXIMITY_PCT && last < target) {
      const at = position.lastAt || now.toISOString();
      const key = `near-target:${position.id}:${target.toFixed(2)}`;
      alerts.push(
        alertFor(
          key,
          at,
          'target',
          position.symbol,
          `Near target · ${position.symbol}`,
          `Last $${last.toFixed(2)} is $${(target - last).toFixed(2)} (${targetDistance.toFixed(2)}%) below the $${target.toFixed(
            2
          )} target.`,
          {
            state: 'near',
            qty: position.qty,
            entry: Number(position.entry),
            last,
            target,
            distancePct: targetDistance,
          }
        )
      );
    }
  }

  if (state.lastScan) {
    for (const result of state.lastScan.results) {
      if (result.status !== 'triggered' || result.risk !== 'PASS' || !result.plan) continue;
      const plan = result.plan;
      const key = `signal:${result.symbol}:${plan.triggerAt}:${plan.entry.toFixed(2)}`;
      alerts.push(
        alertFor(
          key,
          state.lastScan.at,
          'signal',
          result.symbol,
          `Entry trigger · ${result.symbol}`,
          `Opening-range breakout at $${plan.entry.toFixed(2)} · risk PASS · planned ${plan.qty} shares.`,
          {
            orderQty: plan.qty,
            entry: plan.entry,
            stop: plan.stop,
            target: plan.target,
            risk: 'PASS',
            triggerAt: plan.triggerAt,
          }
        )
      );
    }
  }

  for (const item of state.activity || []) {
    if (item.type !== 'error' || item.test) continue;
    const key = `error:${item.symbol || 'automation'}:${item.message}`;
    alerts.push(
      alertFor(key, item.at, 'error', item.symbol || null, `Automation error${item.symbol ? ` · ${item.symbol}` : ''}`, item.message, {
        message: item.message,
      })
    );
  }

  return alerts;
}

export function mergeAlerts(existing: LocalAlert[], candidates: LocalAlert[], limit = 100) {
  const byKey = new Map<string, LocalAlert>();
  for (const alert of existing || []) byKey.set(alert.key, alert);
  for (const alert of candidates || []) {
    if (!byKey.has(alert.key)) byKey.set(alert.key, alert);
  }
  return [...byKey.values()]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
