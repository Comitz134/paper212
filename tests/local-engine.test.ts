import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlertCandidates,
  closePosition,
  createLocalState,
  entryExecutionCheck,
  getMarketClock,
  manageExits,
  mergeAlerts,
  normalizeConfig,
  openPosition,
  scanIsDue,
} from '../src/local/ledger';
import { evaluateOpeningRange, parseYahooChart, type ParsedChart } from '../src/local/market';

const CONFIG = normalizeConfig({ watchlist: ['AAPL'], pollSeconds: 180 });
const NOW = new Date('2026-11-03T15:00:00Z'); // 10:00 ET, a Tuesday.

function chart(): ParsedChart {
  const bars = [
    { t: Date.parse('2026-11-03T14:30:00Z') / 1000, o: 100, h: 100.6, l: 99.2, c: 100.1, v: 50000 },
    { t: Date.parse('2026-11-03T14:35:00Z') / 1000, o: 100.1, h: 100.4, l: 99.5, c: 99.8, v: 30000 },
    { t: Date.parse('2026-11-03T14:40:00Z') / 1000, o: 99.8, h: 100.2, l: 99.6, c: 99.9, v: 28000 },
    { t: Date.parse('2026-11-03T14:45:00Z') / 1000, o: 99.9, h: 101.5, l: 99.9, c: 101.2, v: 60000 },
    { t: Date.parse('2026-11-03T14:50:00Z') / 1000, o: 101.2, h: 101.4, l: 100.9, c: 101.0, v: 25000 },
    { t: Date.parse('2026-11-03T14:55:00Z') / 1000, o: 101.0, h: 101.3, l: 100.8, c: 101.1, v: 22000 },
  ];
  return { symbol: 'AAPL', price: 101.1, previousClose: 99.4, marketTime: 1793800000, bars };
}

test('the market clock opens the entry window and respects holidays', () => {
  const open = getMarketClock(NOW, CONFIG);
  assert.equal(open.open, true);
  assert.equal(open.entryOpen, true);
  assert.equal(open.phase, 'entry');

  const holiday = getMarketClock(new Date('2026-11-26T15:00:00Z'), CONFIG);
  assert.equal(holiday.open, false);
  assert.equal(holiday.entryOpen, false);
  assert.match(holiday.label, /Thanksgiving/);
});

test('automatic scan cadence is measured from the last scan, not the latest poll', () => {
  const lastScan = '2026-11-03T15:20:00Z';
  assert.equal(scanIsDue(new Date('2026-11-03T15:22:50Z'), lastScan, 180), false);
  assert.equal(scanIsDue(new Date('2026-11-03T15:23:00Z'), lastScan, 180), true);
  assert.equal(scanIsDue(new Date('2026-11-03T15:22:00Z'), lastScan, 180, true), true);
  assert.equal(scanIsDue(new Date('2026-11-03T15:22:00Z'), null, 180), true);
});

test('opening-range scanner triggers only after a completed close above the range', () => {
  const early = evaluateOpeningRange({
    symbol: 'AAPL',
    chart: chart(),
    now: new Date('2026-11-03T14:40:00Z'), // 9:40 ET, range still forming.
    config: CONFIG,
    cash: 100000,
    equity: 100000,
  });
  assert.equal(early.status, 'waiting');
  assert.match(early.reason, /range is set at 9:45/);

  const result = evaluateOpeningRange({
    symbol: 'AAPL',
    chart: chart(),
    now: NOW,
    config: CONFIG,
    cash: 100000,
    equity: 100000,
  });
  assert.equal(result.status, 'triggered');
  assert.equal(result.risk, 'PASS');
  assert.equal(result.orderQty, 98);
  assert.ok(result.plan);
  assert.equal(result.plan.entry, 101.2);
  assert.equal(result.plan.stop, 99.9);
  assert.equal(result.plan.target, 103.8);
  assert.match(result.reason, /9:45 bar/);
});

test('the stale-entry guard refuses chasing a breakout', () => {
  const plan = { entry: 101.2, stop: 99.9, target: 103.8 };
  assert.equal(entryExecutionCheck(plan, { last: 101.2 }).ok, true);
  assert.equal(entryExecutionCheck(plan, { last: 103 }).ok, false);
  assert.match(entryExecutionCheck(plan, { last: 103 }).reason || '', /more than 1%/);
});

test('paper fills, stop exits, P&L and alert de-duplication are deterministic', () => {
  const state = createLocalState(CONFIG, NOW);
  const opened = openPosition(
    state,
    {
      symbol: 'AAPL',
      qty: 96,
      price: 101.2,
      stop: 99.9,
      target: 103.8,
      setup: 'orb',
      plan: { entry: 101.2, stop: 99.9, target: 103.8, reward_risk: 2, flat_by: '15:55' },
      reason: 'test entry',
    },
    NOW,
    CONFIG
  );
  assert.equal('error' in opened, false);
  assert.equal(state.positions.AAPL.qty, 96);
  assert.ok(Math.abs(state.cash - (100000 - 96 * 101.2)) < 1e-8);

  state.positions.AAPL.last = 100;
  state.positions.AAPL.lastAt = NOW.toISOString();
  const near = buildAlertCandidates(state, NOW);
  const stopWarning = near.find((alert) => alert.category === 'stop');
  assert.ok(stopWarning);
  assert.equal(stopWarning.symbol, 'AAPL');
  assert.equal(stopWarning.data.state, 'near');
  assert.equal(stopWarning.data.stop, 99.9);
  assert.ok(Number(stopWarning.data.distancePct) > 0);
  assert.ok(Number(stopWarning.data.distancePct) <= 0.35);

  const closed = manageExits(state, { AAPL: { last: 99.9 } }, getMarketClock(NOW, CONFIG), NOW, CONFIG);
  assert.equal(closed.length, 1);
  assert.equal(state.positions.AAPL, undefined);
  assert.ok(Math.abs(Number(closed[0].pnl) - (99.9 - 101.2) * 96) < 1e-8);

  const again = buildAlertCandidates(state, NOW);
  const first = mergeAlerts([], again);
  const second = mergeAlerts(first, again);
  assert.equal(first.filter((alert) => alert.category === 'fill').length, 1);
  assert.equal(first.filter((alert) => alert.category === 'stop').length, 1);
  assert.equal(second.length, first.length);
  assert.deepEqual(second.map((alert) => alert.id), first.map((alert) => alert.id));
});

test('Yahoo chart parsing keeps only valid OHLC bars', () => {
  const parsed = parseYahooChart({
    chart: {
      result: [
        {
          meta: { symbol: 'AAPL', regularMarketPrice: 101.1, chartPreviousClose: 99.4, regularMarketTime: 1793800000 },
          timestamp: [1793800000, 1793800300],
          indicators: {
            quote: [
              {
                open: [100, null],
                high: [101, 102],
                low: [99, 100],
                close: [100.5, null],
                volume: [1000, 2000],
              },
            ],
          },
        },
      ],
    },
  });
  assert.equal(parsed.symbol, 'AAPL');
  assert.equal(parsed.price, 101.1);
  assert.equal(parsed.bars.length, 1);
  assert.equal(parsed.bars[0].c, 100.5);
});
