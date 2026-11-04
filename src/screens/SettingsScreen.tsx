import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Pill, SectionHeader, ToggleRow } from '../components';
import { colors, fontMono, radius, space } from '../theme';
import type { NotificationPrefs, Settings } from '../types';
import type { BackgroundState, PermissionState } from '../notifications';

export default function SettingsScreen({
  settings,
  permission,
  background,
  onToggle,
  onEnableNotifications,
  onTestNotification,
  onReset,
}: {
  settings: Settings;
  permission: PermissionState;
  background: BackgroundState;
  onToggle: (key: keyof NotificationPrefs, value: boolean) => void;
  onEnableNotifications: () => Promise<void>;
  onTestNotification: () => Promise<void>;
  onReset: () => void;
}) {
  const [enabling, setEnabling] = useState(false);
  const [testing, setTesting] = useState(false);

  async function enable() {
    setEnabling(true);
    try {
      await onEnableNotifications();
    } finally {
      setEnabling(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await onTestNotification();
    } finally {
      setTesting(false);
    }
  }

  function openSystemSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert('Open settings', 'Open your phone settings and allow notifications for Paper212.');
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <View>
          <Text style={styles.eyebrow}>ON-DEVICE AUTOMATION</Text>
          <Text style={styles.title}>Settings</Text>
        </View>
        <Pill label="PAPER ONLY" tone="green" />
      </View>

      <Card style={styles.card}>
        <SectionHeader title="Paper212 on this phone" meta="Local" icon="phone-portrait-outline" />
        <Text style={styles.accountLabel}>Standalone paper account</Text>
        <Text style={styles.helper}>
          The scanner, ledger, scheduler and alert feed live on this phone. No PC, network setup or remote account is required.
        </Text>
        <View style={styles.rowButtons}>
          <Button label="Reset paper account" variant="danger" icon="trash-outline" onPress={onReset} style={styles.rowButton} />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionHeader
          title="Alerts"
          meta={permission.granted ? 'On' : 'Off'}
          icon="notifications-outline"
        />
        <View style={styles.permissionRow}>
          <Pill label={permission.granted ? 'OS PERMISSION ON' : 'OS PERMISSION OFF'} tone={permission.granted ? 'green' : 'gold'} />
        </View>
        <Text style={styles.helper}>{permission.label}</Text>
        {!permission.granted ? (
          <View style={styles.rowButtons}>
            {permission.canAsk ? (
              <Button label="Enable alerts" variant="success" icon="notifications" loading={enabling} onPress={enable} style={styles.rowButton} />
            ) : (
              <Button label="Open system settings" variant="ghost" icon="settings-outline" onPress={openSystemSettings} style={styles.rowButton} />
            )}
          </View>
        ) : null}
        <Button
          label="Send test alert"
          variant="ghost"
          icon="paper-plane-outline"
          loading={testing}
          disabled={!permission.granted}
          onPress={test}
          style={styles.fullButton}
        />

        <View style={styles.toggleList}>
          <ToggleRow
            label="Entry signals"
            description="A new watchlist symbol triggers an opening-range entry."
            value={settings.notifications.signals}
            onValueChange={(value) => onToggle('signals', value)}
          />
          <ToggleRow
            label="Fills and exits"
            description="Paper buy fills, stop-loss exits and take-profit exits."
            value={settings.notifications.fills}
            onValueChange={(value) => onToggle('fills', value)}
          />
          <ToggleRow
            label="Automation errors"
            description="On-device scan, quote and storage failures with their symbol and reason."
            value={settings.notifications.errors}
            onValueChange={(value) => onToggle('errors', value)}
          />
          <ToggleRow
            label="Stop / target proximity"
            description={`Alert when a position is within 0.35% of its stop or target.`}
            value={settings.notifications.proximity}
            onValueChange={(value) => onToggle('proximity', value)}
          />
          <ToggleRow
            label="Background checks"
            description="Run the local engine while the app is backgrounded. The OS controls timing; 15 minutes is the minimum."
            value={settings.notifications.background}
            onValueChange={(value) => onToggle('background', value)}
          />
        </View>
        <Text style={styles.backgroundLabel}>{background.label}</Text>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="How this works" icon="information-circle-outline" />
        <Text style={styles.helper}>
          The on-device engine scans the watchlist during the 09:45–15:30 ET opening-range window, sizes risk-checked paper entries, manages stops, 2R targets and the 15:55 ET flat-by exit, and stores the ledger in app storage. It never connects to a broker and cannot place a real order.
        </Text>
        <Text style={styles.helper}>
          Alerts are local while the app is open. Background checks are best effort because iOS and Android decide when to wake an app; a force-stopped app cannot be woken at all. Guaranteed execution while terminated needs a hosted backend.
        </Text>
      </Card>

      <Text style={styles.version}>Paper212 Mobile · standalone paper engine · no broker</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 30, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: colors.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 3 },
  card: { gap: 10 },
  accountLabel: { color: colors.text, fontFamily: fontMono, fontSize: 12, lineHeight: 18 },
  helper: { color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  rowButtons: { flexDirection: 'row', gap: 8 },
  rowButton: { flex: 1 },
  fullButton: { width: '100%' },
  permissionRow: { flexDirection: 'row' },
  toggleList: { marginTop: 3 },
  backgroundLabel: { color: colors.gold, fontSize: 9.5, lineHeight: 14, marginTop: 4 },
  version: { color: colors.dim, fontSize: 9, textAlign: 'center', marginTop: 4 },
});
