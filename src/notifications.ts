import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { fetchSnapshot } from './api';
import { isAlertEnabled } from './alerts';
import { loadCursors, loadSettings, saveCursors } from './storage';
import type { Cursors, MobileAlert, Settings, Snapshot } from './types';

export const ALERT_CHANNEL = 'paper212-alerts';
const BACKGROUND_TASK = 'paper212-background-refresh';

export type PermissionState = {
  granted: boolean;
  label: string;
  canAsk: boolean;
};

export type BackgroundState = {
  available: boolean;
  label: string;
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
    name: 'Paper212 alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#00c805',
    sound: 'default',
    showBadge: false,
  });
}

export async function notificationPermission(request = false): Promise<PermissionState> {
  if (Platform.OS === 'web') {
    return { granted: false, label: 'System alerts are available in the native app only.', canAsk: false };
  }
  try {
    await ensureAndroidChannel();
    let status = await Notifications.getPermissionsAsync();
    if (!status.granted && request) status = await Notifications.requestPermissionsAsync();
    if (status.granted) {
      return { granted: true, label: 'Alerts allowed on this phone.', canAsk: true };
    }
    const canAsk = status.canAskAgain !== false;
    return {
      granted: false,
      label: canAsk ? 'Alerts are not enabled yet. Tap Enable alerts.' : 'Alerts are blocked in system settings.',
      canAsk,
    };
  } catch (error) {
    return {
      granted: false,
      label: (error as Error)?.message || 'Notification permission is unavailable in this build.',
      canAsk: false,
    };
  }
}

export async function sendTestNotification() {
  if (Platform.OS === 'web') return false;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Paper212 test alert',
      body: 'Local alerts are working. This is a paper-trading alert, not a real order.',
      sound: 'default',
      data: { kind: 'test' },
      ...(Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : {}),
    } as Notifications.NotificationContentInput,
    trigger: null,
  });
  return true;
}

async function notify(alert: MobileAlert) {
  if (Platform.OS === 'web') return;
  try {
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.title,
        body: alert.message,
        sound: 'default',
        data: {
          kind: alert.category,
          alertId: alert.id,
          symbol: alert.symbol,
          ...alert.data,
        },
        threadIdentifier: 'paper212',
        ...(Platform.OS === 'android' ? { channelId: ALERT_CHANNEL } : {}),
      } as Notifications.NotificationContentInput,
      trigger: null,
    });
  } catch {
    // Alerts must never take down the dashboard.
  }
}

// Serializing the cursor read/notify/write sequence makes delivery exactly-once
// even when a foreground poll, a manual action and a background fetch overlap.
let deliveryQueue: Promise<unknown> = Promise.resolve();

export function processSnapshotNotifications(
  snapshot: Snapshot,
  settings: Settings,
  current?: Cursors
): Promise<Cursors> {
  const task = deliveryQueue.then(async () => {
    const base = current || (await loadCursors());
    const next: Cursors = { ...base };
    const alerts = Array.isArray(snapshot.alerts) ? snapshot.alerts : [];
    const top = alerts[0];

    // The first snapshot establishes a baseline; old history should be visible
    // in the alert feed, not replayed as a burst of notifications.
    if (!base.lastAlertId && !base.lastAlertAt) {
      next.lastAlertId = top?.id;
      next.lastAlertAt = top?.at;
    } else {
      const index = base.lastAlertId
        ? alerts.findIndex((alert) => alert.id === base.lastAlertId)
        : -1;
      let fresh: MobileAlert[] = [];
      if (index >= 0) {
        fresh = alerts.slice(0, index).reverse();
      } else {
        const lastMs = base.lastAlertAt ? Date.parse(base.lastAlertAt) : 0;
        fresh = alerts
          .filter((alert) => Number.isFinite(Date.parse(alert.at)) && Date.parse(alert.at) > lastMs)
          .slice(0, 8)
          .reverse();
      }

      for (const alert of fresh) {
        // Disabled categories still advance the cursor. Re-enabling a category
        // must not replay alerts the user deliberately suppressed.
        if (!isAlertEnabled(alert, settings.notifications)) continue;
        await notify(alert);
      }

      next.lastAlertId = top?.id || base.lastAlertId;
      next.lastAlertAt = top?.at || base.lastAlertAt;
    }

    if (!current) await saveCursors(next);
    return next;
  });
  deliveryQueue = task.catch(() => {});
  return task;
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BACKGROUND_TASK)) {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      const settings = await loadSettings();
      if (!settings || !settings.notifications.background) return BackgroundTask.BackgroundTaskResult.Success;
      const snapshot = await fetchSnapshot(settings, 15_000);
      await processSnapshotNotifications(snapshot, settings);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function backgroundStatus(enabled: boolean): Promise<BackgroundState> {
  if (Platform.OS === 'web') {
    return { available: false, label: 'Background checks are available in the native app only.' };
  }
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      return { available: false, label: 'Background checks are restricted by this device.' };
    }
    if (!enabled) {
      if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK);
      }
      return { available: true, label: 'Background checks are off.' };
    }
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 15 });
    return {
      available: true,
      label: 'Best effort: the system decides when to run the local engine, usually no more than every 15 min.',
    };
  } catch (error) {
    return {
      available: false,
      label: (error as Error)?.message || 'Background checks are unavailable in this build.',
    };
  }
}

export async function refreshBackgroundRegistration(enabled: boolean) {
  return backgroundStatus(enabled);
}
