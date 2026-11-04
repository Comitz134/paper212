import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, fontMono, radius, space, toneColor } from './theme';
import { etTime, money, price, pct, quantity, signedMoney } from './format';
import type { ActivityItem, ClosedTrade, Position } from './types';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  meta,
  icon,
}: {
  title: string;
  meta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        {icon ? <Ionicons name={icon} size={14} color={colors.dim} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

type PillTone = 'neutral' | 'green' | 'red' | 'gold' | 'blue' | 'muted';

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const palette: Record<PillTone, { color: string; background: string; border: string }> = {
    neutral: { color: colors.text, background: colors.panel3, border: colors.line2 },
    green: { color: colors.green, background: 'rgba(0,200,5,0.10)', border: 'rgba(0,200,5,0.25)' },
    red: { color: colors.red, background: 'rgba(255,77,94,0.10)', border: 'rgba(255,77,94,0.25)' },
    gold: { color: colors.gold, background: 'rgba(240,185,11,0.10)', border: 'rgba(240,185,11,0.25)' },
    blue: { color: colors.blue, background: 'rgba(91,140,255,0.12)', border: 'rgba(91,140,255,0.28)' },
    muted: { color: colors.muted, background: 'rgba(139,154,176,0.08)', border: colors.line },
  };
  const colorsForTone = palette[tone];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colorsForTone.background, borderColor: colorsForTone.border },
      ]}
    >
      <Text style={[styles.pillText, { color: colorsForTone.color }]}>{label}</Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: number;
  hint?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.statValue, tone !== undefined ? { color: toneColor(tone) } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Sparkline({
  data,
  width,
  height = 72,
}: {
  data: { equity: number }[];
  width: number;
  height?: number;
}) {
  const values = data.map((point) => Number(point.equity)).filter(Number.isFinite);
  if (values.length < 2) {
    return (
      <View style={[styles.sparkEmpty, { width, height }]}>
        <View style={styles.sparkEmptyLine} />
        <Text style={styles.sparkEmptyText}>Equity history builds after the next run</Text>
      </View>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const pad = 7;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = pad + (1 - (value - min) / spread) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const positive = values[values.length - 1] >= values[0];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="paper212Spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={positive ? colors.green : colors.red} stopOpacity={0.22} />
          <Stop offset="1" stopColor={positive ? colors.green : colors.red} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#paper212Spark)" />
      <Path
        d={line}
        fill="none"
        stroke={positive ? colors.green : colors.red}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PositionCard({ position }: { position: Position }) {
  const total = (Number(position.target) || 0) - (Number(position.stop) || 0);
  const progress =
    total > 0
      ? Math.min(1, Math.max(0, ((Number(position.last) || 0) - Number(position.stop)) / total))
      : 0;
  return (
    <View style={styles.position}>
      <View style={styles.positionTop}>
        <View style={styles.symbolWrap}>
          <View style={styles.symbolBadge}>
            <Text style={styles.symbolBadgeText}>{position.symbol.slice(0, 1)}</Text>
          </View>
          <View>
            <Text style={styles.symbol}>{position.symbol}</Text>
            <Text style={styles.positionSub}>
              {quantity(position.qty)} shares · opened {etTime(position.openedAt)}
            </Text>
          </View>
        </View>
        <View style={styles.positionPnlWrap}>
          <Text style={[styles.positionPnl, { color: toneColor(position.pnl) }]}>
            {signedMoney(position.pnl)}
          </Text>
          <Text style={[styles.positionPct, { color: toneColor(position.pnl) }]}>
            {pct(position.pnlPct)}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>ENTRY</Text>
          <Text style={styles.priceValue}>{price(position.entry)}</Text>
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>LAST</Text>
          <Text style={styles.priceValue}>{price(position.last)}</Text>
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>STOP</Text>
          <Text style={[styles.priceValue, { color: colors.red }]}>{price(position.stop)}</Text>
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>TARGET</Text>
          <Text style={[styles.priceValue, { color: colors.green }]}>{price(position.target)}</Text>
        </View>
      </View>

      <View style={styles.rangeTrack}>
        <View style={[styles.rangeFill, { width: `${progress * 100}%` }]} />
        <View style={[styles.rangeMarker, { left: `${progress * 100}%` }]} />
      </View>
      <View style={styles.rangeLabels}>
        <Text style={styles.rangeLabel}>stop</Text>
        <Text style={styles.rangeLabel}>last {price(position.last)}</Text>
        <Text style={styles.rangeLabel}>target</Text>
      </View>
    </View>
  );
}

export function TradeRow({ trade }: { trade: ClosedTrade }) {
  return (
    <View style={styles.tradeRow}>
      <View style={styles.tradeSymbolWrap}>
        <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
        <Text style={styles.tradeSub}>
          {quantity(trade.qty)} @ {price(trade.entry)} → {price(trade.exit)}
        </Text>
      </View>
      <View style={styles.tradeRight}>
        <Text style={[styles.tradePnl, { color: toneColor(trade.pnl) }]}>{signedMoney(trade.pnl)}</Text>
        <Text style={styles.tradeSub} numberOfLines={1}>
          {trade.reason || 'exit'} · {etTime(trade.closedAt)}
        </Text>
      </View>
    </View>
  );
}

function activityTone(type: ActivityItem['type']) {
  if (type === 'trade') return colors.blue;
  if (type === 'win') return colors.green;
  if (type === 'loss') return colors.red;
  if (type === 'error') return colors.red;
  if (type === 'skip') return colors.gold;
  return colors.dim;
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityDot, { backgroundColor: activityTone(item.type) }]} />
      <View style={styles.activityMain}>
        <View style={styles.activityMessageRow}>
          <Text style={styles.activityMessage}>{item.message}</Text>
          {item.test ? <Pill label="TEST" tone="gold" /> : null}
        </View>
        <Text style={styles.activityMeta}>
          {etTime(item.at)}
          {item.symbol ? ` · ${item.symbol}` : ''}
        </Text>
      </View>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { background: colors.blue, border: colors.blue, text: colors.white },
    ghost: { background: 'transparent', border: colors.line2, text: colors.text },
    danger: { background: 'rgba(255,77,94,0.10)', border: 'rgba(255,77,94,0.35)', text: colors.red },
    success: { background: 'rgba(0,200,5,0.12)', border: 'rgba(0,200,5,0.35)', text: colors.green },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed ? { opacity: 0.8 } : null,
        disabled || loading ? { opacity: 0.45 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={15} color={palette.text} /> : null}
          <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.fieldWrap, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.dim}
        style={[styles.field, props.multiline ? styles.fieldMultiline : null]}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled ? { opacity: 0.5 } : null]}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.line2, true: 'rgba(0,200,5,0.45)' }}
        thumbColor={value ? colors.green : '#8593a8'}
      />
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={22} color={colors.dim} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="cloud-offline-outline" size={17} color={colors.red} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.errorRetry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.24 }]}>
      <View style={styles.logoBars}>
        <View style={[styles.logoBar, { height: size * 0.32, backgroundColor: colors.green }]} />
        <View style={[styles.logoBar, { height: size * 0.5, backgroundColor: colors.red }]} />
        <View style={[styles.logoBar, { height: size * 0.4, backgroundColor: colors.green }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionMeta: { color: colors.dim, fontFamily: fontMono, fontSize: 10 },
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  statTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 120,
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  statLabel: {
    color: colors.dim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontFamily: fontMono, fontSize: 17, fontWeight: '600', marginTop: 5 },
  statHint: { color: colors.dim, fontSize: 9, marginTop: 3 },
  sparkEmpty: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  sparkEmptyLine: { width: '100%', height: 1, backgroundColor: colors.line },
  sparkEmptyText: { color: colors.dim, fontSize: 9 },
  position: {
    backgroundColor: colors.panel2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 13,
    gap: 11,
  },
  positionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  symbolWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  symbolBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.panel3,
    borderColor: colors.line2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeText: { color: colors.text, fontFamily: fontMono, fontWeight: '700', fontSize: 13 },
  symbol: { color: colors.text, fontFamily: fontMono, fontWeight: '700', fontSize: 15 },
  positionSub: { color: colors.dim, fontSize: 9, marginTop: 2 },
  positionPnlWrap: { alignItems: 'flex-end' },
  positionPnl: { fontFamily: fontMono, fontSize: 16, fontWeight: '700' },
  positionPct: { fontFamily: fontMono, fontSize: 10, marginTop: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  priceCell: { flex: 1 },
  priceLabel: { color: colors.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  priceValue: { color: colors.text, fontFamily: fontMono, fontSize: 12, marginTop: 3 },
  rangeTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: 'visible',
    marginTop: 2,
  },
  rangeFill: { height: 4, borderRadius: 4, backgroundColor: colors.blue },
  rangeMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 10,
    marginLeft: -1,
    backgroundColor: colors.text,
  },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -5 },
  rangeLabel: { color: colors.dim, fontSize: 8, fontFamily: fontMono },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tradeSymbolWrap: { flex: 1 },
  tradeSymbol: { color: colors.text, fontFamily: fontMono, fontSize: 12, fontWeight: '700' },
  tradeSub: { color: colors.dim, fontSize: 9, marginTop: 2 },
  tradeRight: { alignItems: 'flex-end', maxWidth: '52%' },
  tradePnl: { fontFamily: fontMono, fontSize: 12, fontWeight: '700' },
  activityRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  activityMain: { flex: 1, gap: 3 },
  activityMessageRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  activityMessage: { color: '#d6e0ed', fontSize: 12, lineHeight: 17, flexShrink: 1 },
  activityMeta: { color: colors.dim, fontFamily: fontMono, fontSize: 9 },
  button: {
    minHeight: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: { fontSize: 12, fontWeight: '700' },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: colors.dim,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.panel2,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: fontMono,
  },
  fieldMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 11 },
  fieldHint: { color: colors.dim, fontSize: 10, lineHeight: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 3 },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  toggleDescription: { color: colors.dim, fontSize: 10, lineHeight: 14 },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 7 },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  emptyBody: { color: colors.dim, fontSize: 11, textAlign: 'center', lineHeight: 16, maxWidth: 280 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,77,94,0.3)',
    backgroundColor: 'rgba(255,77,94,0.08)',
    borderRadius: radius.sm,
    padding: 11,
  },
  errorText: { color: '#ffb0b7', fontSize: 11, flex: 1, lineHeight: 15 },
  errorRetry: { color: colors.red, fontSize: 11, fontWeight: '700' },
  logo: { backgroundColor: colors.panel2, borderColor: colors.line2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: '58%' },
  logoBar: { width: 4, borderRadius: 1 },
});
