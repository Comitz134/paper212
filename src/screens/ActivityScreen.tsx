import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityRow, Card, EmptyState, ErrorBanner, Pill, SectionHeader } from '../components';
import { alertLabel, alertNumbers, alertTone, filterAlerts } from '../alerts';
import { etTime } from '../format';
import { colors, fontMono, radius, space } from '../theme';
import type { ActivityKind, MobileAlert, NotificationPrefs, Snapshot } from '../types';

type Filter = 'all' | 'trades' | 'exits' | 'signals' | 'errors';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trades', label: 'Fills' },
  { key: 'exits', label: 'Exits' },
  { key: 'signals', label: 'Signals' },
  { key: 'errors', label: 'Errors' },
];

function matches(filter: Filter, type: ActivityKind) {
  if (filter === 'all') return true;
  if (filter === 'trades') return type === 'trade';
  if (filter === 'exits') return type === 'win' || type === 'loss';
  if (filter === 'signals') return type === 'skip';
  return type === 'error';
}

function AlertRow({ alert }: { alert: MobileAlert }) {
  return (
    <View style={styles.alertRow}>
      <View style={[styles.alertStripe, { backgroundColor: alertTone(alert.category) === 'red' ? colors.red : alertTone(alert.category) === 'green' ? colors.green : colors.blue }]} />
      <View style={styles.alertMain}>
        <View style={styles.alertHead}>
          <Pill label={alertLabel(alert.category)} tone={alertTone(alert.category)} />
          <Text style={styles.alertSymbol}>{alert.symbol || 'AUTOMATION'}</Text>
          <Text style={styles.alertTime}>{etTime(alert.at)}</Text>
        </View>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertMessage}>{alert.message}</Text>
        <Text style={styles.alertNumbers}>{alertNumbers(alert)}</Text>
      </View>
    </View>
  );
}

export default function ActivityScreen({
  snapshot,
  notifications,
  error,
  refreshing,
  onRefresh,
}: {
  snapshot: Snapshot;
  notifications: NotificationPrefs;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const alerts = useMemo(
    () => filterAlerts(snapshot.alerts, notifications).slice(0, 10),
    [snapshot.alerts, notifications]
  );
  const items = useMemo(
    () => snapshot.activity.filter((item) => matches(filter, item.type)),
    [snapshot.activity, filter]
  );
  const errorCount = snapshot.activity.filter((item) => item.type === 'error').length;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View>
          <Text style={styles.eyebrow}>AUDIT TRAIL</Text>
          <Text style={styles.title}>Activity</Text>
        </View>
        <View style={[styles.errorCount, { borderColor: errorCount ? 'rgba(255,77,94,0.3)' : colors.line }]}>
          <Text style={[styles.errorCountValue, { color: errorCount ? colors.red : colors.muted }]}>{errorCount}</Text>
          <Text style={styles.errorCountLabel}>errors</Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={onRefresh} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Alerts" meta={alerts.length ? `${alerts.length} recent` : 'Filtered'} icon="notifications-outline" />
        <Card style={styles.alertsCard}>
          {alerts.length ? (
            alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
          ) : (
            <EmptyState
              icon="funnel-outline"
              title="No alerts in this view"
              body="Alerts appear when the engine fills, exits, triggers a signal, or gets close to a stop or target. Alert categories can be turned off in Settings."
            />
          )}
        </Card>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.filter, filter === item.key ? styles.filterActive : null]}
          >
            <Text style={[styles.filterText, filter === item.key ? styles.filterTextActive : null]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.feed}>
        {items.length ? (
          items.map((item, index) => <ActivityRow key={`${item.id}-${index}`} item={item} />)
        ) : (
          <EmptyState
            icon="notifications-outline"
            title="Nothing in this filter"
            body="Fills, exits, skips and timestamped skill errors appear here. Pull to refresh."
          />
        )}
      </Card>

      <Text style={styles.note}>
        Activity is written by the on-device automation. A scan, quote or storage failure must appear here with its symbol and reason; it should never look like plain idling.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  section: { gap: 9 },
  alertsCard: { paddingVertical: 3 },
  alertRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  alertStripe: { width: 3, borderRadius: 3, marginRight: 10 },
  alertMain: { flex: 1, gap: 3 },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alertSymbol: { color: colors.text, fontFamily: fontMono, fontSize: 10, fontWeight: '700' },
  alertTime: { color: colors.dim, fontSize: 8.5, marginLeft: 'auto' },
  alertTitle: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  alertMessage: { color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  alertNumbers: { color: colors.blue, fontFamily: fontMono, fontSize: 9, lineHeight: 13 },
  eyebrow: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 3 },
  errorCount: { alignItems: 'center', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 7 },
  errorCountValue: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700' },
  errorCountLabel: { color: colors.dim, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  filters: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filter: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  filterActive: { borderColor: colors.blue, backgroundColor: 'rgba(91,140,255,0.12)' },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: colors.blue },
  feed: { paddingVertical: 3 },
  note: { color: colors.dim, fontSize: 9, lineHeight: 14, paddingHorizontal: 2 },
});
