import React, { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Logo,
  Pill,
  PositionCard,
  SectionHeader,
  Sparkline,
  StatTile,
  TradeRow,
} from '../components';
import { colors, fontMono, radius, space, toneColor } from '../theme';
import { duration, etTime, money, pct, signedMoney } from '../format';
import type { Snapshot } from '../types';

type Action = 'run' | 'pause' | 'resume';

export default function DashboardScreen({
  snapshot,
  error,
  refreshing,
  busyAction,
  onRefresh,
  onAction,
}: {
  snapshot: Snapshot;
  error: string | null;
  refreshing: boolean;
  busyAction: Action | null;
  onRefresh: () => void;
  onAction: (action: Action) => void;
}) {
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const metrics = snapshot.metrics;
  const schedule = snapshot.schedule;
  const engine = snapshot.engine;
  const enabled = snapshot.config.enabled && engine.enabled;
  const simulation = Boolean(engine.simulation?.active);
  const target = schedule?.nextChangeAt ? new Date(schedule.nextChangeAt).getTime() : 0;
  const seconds = target
    ? Math.max(0, Math.round((target - now) / 1000))
    : schedule?.secondsToNextChange ?? 0;
  const engineError = engine.bridge?.lastError;
  const engineLabel = engineError ? `Engine error: ${engineError}` : 'On-device engine ready';

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: 8 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <Logo size={38} />
          <View>
            <Text style={styles.brandName}>
              Paper<Text style={styles.brandAccent}>212</Text>
            </Text>
            <Text style={styles.brandSub}>ON-DEVICE PAPER TERMINAL</Text>
          </View>
        </View>
        <Pill label="PAPER ONLY" tone="green" />
      </View>

      <View style={styles.banner}>
        <View style={[styles.liveDot, { backgroundColor: simulation ? colors.gold : enabled ? colors.green : colors.gold }]} />
        <View style={styles.bannerMain}>
          <Text style={[styles.bannerTitle, { color: simulation ? colors.gold : enabled ? colors.green : colors.gold }]}>
            {simulation ? 'SELF-TEST RUNNING' : enabled ? 'AUTOMATION ON' : 'AUTOMATION PAUSED'}
          </Text>
          <Text style={styles.bannerText}>
            {simulation ? `Replaying ${engine.simulation?.label || 'self-test'} ET` : schedule?.phaseLabel || snapshot.market?.label || 'Market phase unavailable'}
          </Text>
        </View>
        <View style={styles.countdown}>
          <Text style={styles.countdownLabel}>{schedule?.nextChangeLabel || 'Next window'}</Text>
          <Text style={[styles.countdownValue, { color: schedule?.entryOpen ? colors.green : colors.gold }]}>
            {duration(seconds)}
          </Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={onRefresh} /> : null}
      {snapshot.lastError ? <ErrorBanner message={snapshot.lastError} /> : null}

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>AUTOMATION EQUITY</Text>
            <Text style={styles.heroValue}>{money(metrics.equity)}</Text>
          </View>
          <View style={styles.heroPnl}>
            <Text style={[styles.heroToday, { color: toneColor(metrics.todayPnl) }]}>{signedMoney(metrics.todayPnl)}</Text>
            <Text style={styles.heroTodayLabel}>TODAY</Text>
          </View>
        </View>
        <View style={styles.heroSpark}>
          <Sparkline data={snapshot.equityHistory} width={Math.max(260, width - 76)} height={78} />
        </View>
        <View style={styles.heroFoot}>
          <Text style={styles.heroFootText}>Start {money(metrics.startingCash)}</Text>
          <Text style={styles.heroFootText}>Cash {money(metrics.cash)}</Text>
          <Text style={[styles.heroFootText, { color: toneColor(metrics.returnPct) }]}>{pct(metrics.returnPct)}</Text>
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <StatTile label="Total P&L" value={signedMoney(metrics.totalPnl)} tone={metrics.totalPnl} />
        <StatTile label="Unrealized" value={signedMoney(metrics.unrealized)} tone={metrics.unrealized} />
        <StatTile label="Realized" value={signedMoney(metrics.realized)} tone={metrics.realized} />
        <StatTile
          label="Open positions"
          value={`${metrics.openPositions} / ${snapshot.config.maxOpenPositions}`}
          hint={`${metrics.closedTrades} closed · ${metrics.winRate.toFixed(1)}% win`}
        />
      </View>

      <View style={styles.controlRow}>
        <Button
          label="Run scan"
          icon="refresh"
          variant="primary"
          loading={busyAction === 'run'}
          disabled={busyAction !== null || simulation}
          onPress={() => onAction('run')}
          style={styles.controlButton}
        />
        <Button
          label={enabled ? 'Pause' : 'Resume'}
          icon={enabled ? 'pause' : 'play'}
          variant={enabled ? 'danger' : 'success'}
          loading={busyAction === (enabled ? 'pause' : 'resume')}
          disabled={busyAction !== null || simulation}
          onPress={() => onAction(enabled ? 'pause' : 'resume')}
          style={styles.controlButton}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Open positions"
          meta={`${snapshot.positions.length} open`}
          icon="layers-outline"
        />
        {snapshot.positions.length ? (
          <View style={styles.stack}>
            {snapshot.positions.map((position) => (
              <PositionCard key={position.symbol} position={position} />
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon="hourglass-outline"
              title="Waiting for a valid entry"
              body="The on-device scanner only fills when an opening-range trigger passes its risk check. Skips are visible in Activity."
            />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent exits" meta={`${metrics.closedTrades} closed`} icon="swap-horizontal-outline" />
        <Card style={styles.tradesCard}>
          {snapshot.closedTrades.length ? (
            snapshot.closedTrades.slice(0, 5).map((trade) => <TradeRow key={trade.id} trade={trade} />)
          ) : (
            <EmptyState icon="receipt-outline" title="No exits yet" body="Stops, targets and the 15:55 ET flat-by rule appear here." />
          )}
        </Card>
      </View>

      <Card style={styles.engineCard}>
        <View style={styles.engineRow}>
          <View style={styles.engineLeft}>
            <Ionicons name={engineError ? 'alert-circle' : 'phone-portrait'} size={15} color={engineError ? colors.red : colors.blue} />
            <Text style={styles.engineText}>{engineLabel}</Text>
          </View>
          <Text style={styles.engineMeta}>{snapshot.config.pollSeconds}s loop</Text>
        </View>
        <View style={styles.engineRow}>
          <Text style={styles.engineMeta}>Last run {etTime(snapshot.lastRunAt)}</Text>
          <Text style={styles.engineMeta}>Next {etTime(engine.nextRunAt)}</Text>
        </View>
        <Text style={styles.engineNote}>
          The scanner, ledger and scheduler run on this phone. No PC or server is needed; no broker is connected.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  brandAccent: { color: colors.green },
  brandSub: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2, alignSelf: 'flex-start' },
  bannerMain: { flex: 1, gap: 3 },
  bannerTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  bannerText: { color: colors.muted, fontSize: 10 },
  countdown: { alignItems: 'flex-end' },
  countdownLabel: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  countdownValue: { fontFamily: fontMono, fontSize: 12, fontWeight: '700', marginTop: 3 },
  hero: { padding: 17, gap: 8, backgroundColor: colors.panel },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  heroValue: { color: colors.text, fontFamily: fontMono, fontSize: 30, fontWeight: '600', letterSpacing: -1, marginTop: 4 },
  heroPnl: { alignItems: 'flex-end', paddingTop: 2 },
  heroToday: { fontFamily: fontMono, fontSize: 15, fontWeight: '700' },
  heroTodayLabel: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginTop: 3 },
  heroSpark: { alignItems: 'center', marginTop: 4 },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  heroFootText: { color: colors.dim, fontFamily: fontMono, fontSize: 9 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  controlRow: { flexDirection: 'row', gap: 9 },
  controlButton: { flex: 1 },
  section: { gap: 9 },
  stack: { gap: 9 },
  tradesCard: { paddingVertical: 3 },
  engineCard: { gap: 8 },
  engineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  engineLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  engineText: { color: colors.muted, fontSize: 10, flex: 1 },
  engineMeta: { color: colors.dim, fontFamily: fontMono, fontSize: 9 },
  engineNote: { color: colors.dim, fontSize: 9, lineHeight: 14, marginTop: 2 },
});
