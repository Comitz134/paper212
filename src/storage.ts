import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Cursors, NotificationPrefs, Settings } from './types';

const SETTINGS_KEY = 'paper212.mobile.settings.v1';
const CURSORS_KEY = 'paper212.mobile.cursors.v1';
const memory = new Map<string, string>();

function webStorage(): Storage | null {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* unavailable */
  }
  return null;
}

async function readKey(key: string): Promise<string | null> {
  const web = webStorage();
  if (web) return web.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  const web = webStorage();
  if (web) {
    web.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    memory.set(key, value);
  }
}

async function deleteKey(key: string): Promise<void> {
  const web = webStorage();
  if (web) {
    web.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  signals: true,
  fills: true,
  errors: true,
  proximity: true,
  background: true,
};

export function createLocalSettings(): Settings {
  return {
    mode: 'local',
    notifications: { ...DEFAULT_NOTIFICATION_PREFS },
    installedAt: new Date().toISOString(),
  };
}

function normalizedPrefs(value: unknown): NotificationPrefs {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<NotificationPrefs>;
  return {
    signals: input.signals !== false,
    fills: input.fills !== false,
    errors: input.errors !== false,
    proximity: input.proximity !== false,
    background: input.background !== false,
  };
}

export async function loadSettings(): Promise<Settings | null> {
  const raw = await readKey(SETTINGS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    if (!parsed || typeof parsed !== 'object' || !parsed.notifications) return null;
    // Re-normalize every install into the standalone settings shape. Any older
    // remote configuration is ignored rather than carried into the native app.
    return {
      mode: 'local',
      notifications: normalizedPrefs(parsed.notifications),
      installedAt: parsed.installedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeKey(
    SETTINGS_KEY,
    JSON.stringify({
      mode: 'local',
      notifications: normalizedPrefs(settings.notifications),
      installedAt: settings.installedAt || new Date().toISOString(),
    })
  );
}

export async function clearSettings(): Promise<void> {
  await deleteKey(SETTINGS_KEY);
  await deleteKey(CURSORS_KEY);
}

export async function loadCursors(): Promise<Cursors> {
  const raw = await readKey(CURSORS_KEY);
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as Cursors) : {};
  } catch {
    return {};
  }
}

export async function saveCursors(cursors: Cursors): Promise<void> {
  await writeKey(CURSORS_KEY, JSON.stringify(cursors));
}
