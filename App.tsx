import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchSnapshot, resetPaperAccount, sendAction } from './src/api';
import {
  backgroundStatus,
  notificationPermission,
  processSnapshotNotifications,
  sendTestNotification,
  type BackgroundState,
  type PermissionState,
} from './src/notifications';
import { createLocalSettings, loadSettings, saveCursors, saveSettings } from './src/storage';
import { colors, fontMono, space } from './src/theme';
import type { NotificationPrefs, Settings, Snapshot } from './src/types';
import DashboardScreen from './src/screens/DashboardScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import SettingsScreen from './src/screens/SettingsScreen';

type TabKey = 'home' | 'scanner' | 'activity' | 'settings';
type Action = 'run' | 'pause' | 'resume';

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'scanner', label: 'Scanner', icon: 'scan' },
  { key: 'activity', label: 'Activity', icon: 'notifications' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

function Root() {
  const insets = useSafeAreaInsets();
  const [booted, setBooted] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [tab, setTab] = useState<TabKey>('home');
  const [permission, setPermission] = useState<PermissionState>({
    granted: false,
    label: 'Checking notification permission…',
    canAsk: true,
  });
  const [background, setBackground] = useState<BackgroundState>({
    available: false,
    label: 'Checking background checks…',
  });
  const settingsRef = useRef<Settings | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let saved = await loadSettings();
      if (!saved) saved = createLocalSettings();
      if (!alive) return;
      // Re-save on every boot so settings always use the standalone local shape.
      await saveSettings(saved);
      settingsRef.current = saved;
      setSettings(saved);
      const [nextPermission, nextBackground] = await Promise.all([
        notificationPermission(false),
        backgroundStatus(saved.notifications.background),
      ]);
      if (!alive) return;
      setPermission(nextPermission);
      setBackground(nextBackground);
      setBooted(true);
    })().catch(() => setBooted(true));
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async (showSpinner = false) => {
    const current = settingsRef.current;
    if (!current || inFlight.current) return;
    inFlight.current = true;
    if (showSpinner) setRefreshing(true);
    try {
      const next = await fetchSnapshot(current);
      setSnapshot(next);
      setError(null);
      await processSnapshotNotifications(next, current);
    } catch (err) {
      setError((err as Error).message || 'Paper212 is unreachable.');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!settings) {
      settingsRef.current = null;
      return;
    }
    settingsRef.current = settings;
    void refresh(false);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh(false);
    }, 10_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(false);
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [settings, refresh]);

  async function handleAction(action: Action) {
    const current = settingsRef.current;
    if (!current || busyAction) return;
    setBusyAction(action);
    try {
      const next = await sendAction(current, action);
      setSnapshot(next);
      setError(null);
      await processSnapshotNotifications(next, current);
    } catch (err) {
      Alert.alert('Automation action failed', (err as Error).message || 'The on-device engine did not accept the action.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggle(key: keyof NotificationPrefs, value: boolean) {
    if (!settings) return;
    const next: Settings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    };
    setSettings(next);
    settingsRef.current = next;
    await saveSettings(next);
    if (key === 'background') {
      setBackground(await backgroundStatus(value));
    } else if (value && !permission.granted) {
      setPermission(await notificationPermission(true));
    }
  }

  async function enableNotifications() {
    const next = await notificationPermission(true);
    setPermission(next);
    if (!next.granted && !next.canAsk) {
      Alert.alert('Alerts are blocked', 'Open the system settings for Paper212 and allow notifications.');
    }
  }

  async function testNotification() {
    const next = await notificationPermission(true);
    setPermission(next);
    if (!next.granted) {
      Alert.alert('Alerts are off', next.label);
      return;
    }
    await sendTestNotification();
    Alert.alert('Test alert sent', 'Check your notification shade. This is a paper alert only.');
  }

  async function resetLedger() {
    Alert.alert(
      'Reset paper account?',
      'This erases the on-device paper ledger, positions, history and alert feed and starts again at $100,000. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveCursors({});
              const next = await resetPaperAccount();
              setSnapshot(next);
              setError(null);
              setTab('home');
            } catch (err) {
              Alert.alert('Reset failed', (err as Error).message || 'The local ledger could not be reset.');
            }
          },
        },
      ]
    );
  }

  if (!booted) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.green} size="large" />
        <Text style={styles.bootText}>Starting Paper212 Mobile…</Text>
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Ionicons name="phone-portrait-outline" size={30} color={colors.gold} />
        <Text style={styles.errorTitle}>Opening the on-device ledger…</Text>
        <Text style={styles.errorBody}>Paper212 is starting its local paper account. No PC or network server is needed.</Text>
      </View>
    );
  }

  if (!snapshot) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        {error ? (
          <>
            <Ionicons name="phone-portrait-outline" size={30} color={colors.red} />
            <Text style={styles.errorTitle}>Cannot open the paper ledger</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void refresh(true)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={styles.bootText}>Refreshing the on-device paper ledger…</Text>
          </>
        )}
      </View>
    );
  }

  const body =
    tab === 'home' ? (
      <DashboardScreen
        snapshot={snapshot}
        error={error}
        refreshing={refreshing}
        busyAction={busyAction}
        onRefresh={() => void refresh(true)}
        onAction={(action) => void handleAction(action)}
      />
    ) : tab === 'scanner' ? (
      <ScannerScreen
        snapshot={snapshot}
        error={error}
        refreshing={refreshing}
        onRefresh={() => void refresh(true)}
      />
    ) : tab === 'activity' ? (
      <ActivityScreen
        snapshot={snapshot}
        notifications={settings.notifications}
        error={error}
        refreshing={refreshing}
        onRefresh={() => void refresh(true)}
      />
    ) : (
      <SettingsScreen
        settings={settings}
        permission={permission}
        background={background}
        onToggle={(key, value) => void handleToggle(key, value)}
        onEnableNotifications={enableNotifications}
        onTestNotification={testNotification}
        onReset={() => void resetLedger()}
      />
    );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.body, { paddingTop: insets.top }]}>{body}</View>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable key={item.key} style={styles.tab} onPress={() => setTab(item.key)}>
              <Ionicons
                name={active ? item.icon : (`${item.icon}-outline` as keyof typeof Ionicons.glyphMap)}
                size={20}
                color={active ? colors.green : colors.dim}
              />
              <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  bootText: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  errorTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 4 },
  errorBody: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: 'rgba(91,140,255,0.12)',
    borderRadius: 9,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  retryText: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.panel,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 3 },
  tabLabel: { color: colors.dim, fontSize: 9, fontWeight: '700' },
  tabLabelActive: { color: colors.green },
});
