export type ActivityKind = 'trade' | 'win' | 'loss' | 'error' | 'skip' | 'info';
export type AlertCategory = 'signal' | 'fill' | 'exit' | 'stop' | 'target' | 'error';

export interface MobileAlert {
  id: string;
  key: string;
  at: string;
  category: AlertCategory;
  symbol: string | null;
  title: string;
  message: string;
  data: Record<string, string | number | boolean | null>;
}

export interface ActivityItem {
  id: string;
  at: string;
  type: ActivityKind;
  message: string;
  symbol?: string | null;
  test?: boolean;
}

export interface Position {
  symbol: string;
  qty: number;
  entry: number;
  last: number;
  stop: number;
  target: number;
  openedAt: string | null;
  lastAt: string | null;
  maxLoss: number;
  pnl: number;
  pnlPct: number;
  stopDistancePct: number | null;
  targetDistancePct: number | null;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
  openedAt: string | null;
  closedAt: string | null;
  reason: string | null;
}

export interface ScanResult {
  symbol: string;
  status: string;
  reason: string;
  risk: string | null;
  orderQty: number | null;
}

export interface LastScan {
  at: string | null;
  results: ScanResult[];
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

export interface AutomationConfig {
  enabled: boolean;
  watchlist: string[];
  pollSeconds: number;
  maxOpenPositions: number;
  maxTradesPerDay: number;
  maxOrderUsd: number;
  maxLossPerTradeUsd: number;
  startingCash: number;
  noEntriesBefore: string;
  noEntriesAfter: string;
  flatBy: string;
}

export interface MarketClock {
  phase: string;
  label: string;
  open: boolean;
  entryOpen: boolean;
  flat: boolean;
  weekdayOpen?: boolean;
  dateKey?: string;
  hour?: number;
  minute?: number;
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

export interface BridgeStatus {
  state?: string;
  up: boolean;
  pending?: number;
  lastError: string | null;
  lastErrorAt?: string | null;
}

export interface Engine {
  enabled: boolean;
  running: boolean;
  nextRunAt: string | null;
  lastSkip: string | null;
  bridge: BridgeStatus | null;
  simulation: { active: boolean; at?: string; label?: string } | null;
}

export interface SelfTestSummary {
  at: string | null;
  ranAt: string | null;
  fill: {
    symbol: string;
    qty: number;
    fill: number;
    stop: number;
    target: number;
    risk: string | null;
  } | null;
  metrics: Metrics | null;
  errorCount: number;
  skipCount: number;
}

export interface Snapshot {
  ok: boolean;
  apiVersion: number;
  snapshotTime: string;
  app: { name: string; mode: string };
  config: AutomationConfig;
  metrics: Metrics;
  market: MarketClock | null;
  schedule: MarketSchedule | null;
  engine: Engine;
  positions: Position[];
  closedTrades: ClosedTrade[];
  activity: ActivityItem[];
  alerts: MobileAlert[];
  equityHistory: { at: string | null; equity: number; cash: number }[];
  lastScan: LastScan | null;
  selftest: SelfTestSummary | null;
  lastRunAt: string | null;
  lastStatus: { at?: string; market?: string; equity?: number } | null;
  lastError: string | null;
  autostart: { installed: boolean };
}

export interface NotificationPrefs {
  signals: boolean;
  fills: boolean;
  errors: boolean;
  proximity: boolean;
  background: boolean;
}

export interface Settings {
  mode: 'local';
  notifications: NotificationPrefs;
  installedAt: string;
}

export interface Cursors {
  lastAlertId?: string;
  lastAlertAt?: string;
}
