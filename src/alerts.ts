import type { AlertCategory, MobileAlert, NotificationPrefs } from './types';

export type AlertTone = 'green' | 'red' | 'gold' | 'blue' | 'muted';

export function alertFilterKey(category: AlertCategory): keyof NotificationPrefs {
  if (category === 'signal') return 'signals';
  if (category === 'fill' || category === 'exit') return 'fills';
  if (category === 'error') return 'errors';
  return 'proximity';
}

export function isAlertEnabled(alert: MobileAlert, prefs: NotificationPrefs) {
  return prefs[alertFilterKey(alert.category)] !== false;
}

export function filterAlerts(alerts: MobileAlert[], prefs: NotificationPrefs) {
  return (Array.isArray(alerts) ? alerts : []).filter((alert) => isAlertEnabled(alert, prefs));
}

export function alertLabel(category: AlertCategory) {
  if (category === 'signal') return 'SIGNAL';
  if (category === 'fill') return 'FILL';
  if (category === 'exit') return 'EXIT';
  if (category === 'stop') return 'STOP';
  if (category === 'target') return 'TARGET';
  return 'ERROR';
}

export function alertTone(category: AlertCategory): AlertTone {
  if (category === 'signal') return 'blue';
  if (category === 'fill') return 'green';
  if (category === 'exit') return 'blue';
  if (category === 'stop' || category === 'error') return 'red';
  if (category === 'target') return 'green';
  return 'muted';
}

export function alertNumbers(alert: MobileAlert): string {
  const data = alert.data || {};
  const value = (key: string) => {
    const number = Number(data[key]);
    return Number.isFinite(number) ? number : null;
  };
  const cash = (number: number) => `$${number.toFixed(2)}`;
  const qty = () => {
    const number = value('qty');
    return number === null ? '' : `${number} shares`;
  };
  const last = value('last');
  const stop = value('stop');
  const target = value('target');
  const price = value('price') ?? value('entry') ?? value('exit');
  const orderQty = value('orderQty');

  if (alert.category === 'stop' || alert.category === 'target') {
    const level = alert.category === 'stop' ? stop : target;
    return [qty(), last !== null ? `last ${cash(last)}` : '', level !== null ? `${alert.category} ${cash(level)}` : '']
      .filter(Boolean)
      .join(' · ');
  }
  if (alert.category === 'signal') {
    return [orderQty !== null ? `size ${orderQty}` : '', 'risk PASS'].filter(Boolean).join(' · ');
  }
  if (alert.category === 'error') return alert.symbol ? `symbol ${alert.symbol}` : 'automation';
  return [qty(), price !== null ? `at ${cash(price)}` : '', stop !== null ? `stop ${cash(stop)}` : '', target !== null ? `target ${cash(target)}` : '']
    .filter(Boolean)
    .join(' · ');
}
