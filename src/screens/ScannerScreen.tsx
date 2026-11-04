import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Pill, SectionHeader } from '../components';
import { colors, fontMono, radius, space } from '../theme';
import { etTime, price, quantity } from '../format';
import type { ScanResult, Snapshot } from '../types';

function statusTone(status: string): 'green' | 'gold' | 'red' | 'blue' | 'muted' {
  if (status === 'triggered') return 'green';
  if (status === 'waiting') return 'gold';
  if (status === 'error') return 'red';
  return 'muted';
}

function statusLabel(status: string) {
  if (status === 'triggered') return 'TRIGGERED';
  if (status === 'waiting') return 'WAITING';
  if (status === 'error') return 'ERROR';
  return String(status || 'UNKNOWN').toUpperCase();
}

function ResultCard({ result }: { result: ScanResult }) {
  return (
    <Card style={styles.resultCard}>
      <View style={styles.resultTop}>
        <View style={styles.resultSymbolWrap}>
          <Text style={styles.symbol}>{result.symbol}</Text>
          <Text style={styles.resultRisk}>RISK {result.risk || '—'}</Text>
        </View>
        <Pill label={statusLabel(result.status)} tone={statusTone(result.status)} />
      </View>
      <Text style={styles.reason}>{result.reason || 'No additional detail returned.'}</Text>
      {result.orderQty !== null && result.orderQty !== undefined ? (
        <Text style={styles.size}>PLANNED SIZE {quantity(result.orderQty)} shares</Text>
      ) : null}
    </Card>
  );
}

export default function ScannerScreen({
  snapshot,
  error,
  refreshing,
  onRefresh,
}: {
  snapshot: Snapshot;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const scan = snapshot.lastScan;
  const triggered = scan?.results.filter((item) => item.status === 'triggered').length || 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View>
          <Text style={styles.eyebrow}>OPENING-RANGE SCANNER</Text>
          <Text style={styles.title}>Signals</Text>
        </View>
        <View style={styles.headRight}>
          <Text style={styles.headCount}>{scan?.results.length || 0}</Text>
          <Text style={styles.headCountLabel}>symbols</Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={onRefresh} /> : null}

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>LAST SCAN</Text>
            <Text style={styles.summaryValue}>{etTime(scan?.at)}</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={[styles.summaryValue, { color: triggered ? colors.green : colors.muted }]}>{triggered} triggered</Text>
            <Text style={styles.summaryLabel}>RISK-CHECKED FILLS ONLY</Text>
          </View>
        </View>
        <Text style={styles.summaryNote}>
          A trigger is not an order. The on-device engine fills only if risk is PASS and the live quote is still within the entry guard.
        </Text>
      </Card>

      <View style={styles.watchRow}>
        {snapshot.config.watchlist.map((symbol) => (
          <View key={symbol} style={styles.watchChip}>
            <Text style={styles.watchChipText}>{symbol}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Latest skill scan" meta={scan ? `${triggered} triggered` : 'No scan yet'} icon="scan-outline" />
        {scan?.results.length ? (
          <View style={styles.stack}>
            {scan.results.map((result) => (
              <ResultCard key={`${result.symbol}-${result.status}`} result={result} />
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon="scan-outline"
              title="No scan yet"
              body="The on-device scheduler scans during the 09:45–15:30 ET entry window. A manual Run scan also works while the market is open."
            />
          </Card>
        )}
      </View>

      <Card style={styles.rules}>
        <Text style={styles.rulesTitle}>HOW THE AUTOMATION DECIDES</Text>
        <Text style={styles.rule}>01 · 09:45–15:30 ET opening-range breakout only.</Text>
        <Text style={styles.rule}>02 · The on-device scanner must produce a triggered entry and risk PASS.</Text>
        <Text style={styles.rule}>03 · Price must be at/above the trigger but no more than 1% above it.</Text>
        <Text style={styles.rule}>04 · Stops, 2R targets and the 15:55 ET flat-by exit run locally in app storage.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 3 },
  headRight: { alignItems: 'flex-end' },
  headCount: { color: colors.text, fontFamily: fontMono, fontSize: 20, fontWeight: '700' },
  headCountLabel: { color: colors.dim, fontSize: 9 },
  summary: { gap: 9 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  summaryValue: { color: colors.text, fontFamily: fontMono, fontSize: 13, fontWeight: '600', marginTop: 3 },
  summaryRight: { alignItems: 'flex-end', flexShrink: 1 },
  summaryNote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  watchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  watchChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.panel },
  watchChipText: { color: colors.muted, fontFamily: fontMono, fontSize: 10, fontWeight: '600' },
  section: { gap: 9 },
  stack: { gap: 8 },
  resultCard: { padding: 13, gap: 8 },
  resultTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  resultSymbolWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 9, flex: 1 },
  symbol: { color: colors.text, fontFamily: fontMono, fontSize: 16, fontWeight: '700' },
  resultRisk: { color: colors.dim, fontFamily: fontMono, fontSize: 9 },
  reason: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  size: { color: colors.blue, fontFamily: fontMono, fontSize: 9, fontWeight: '700' },
  rules: { gap: 6 },
  rulesTitle: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  rule: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
