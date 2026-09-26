jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => undefined),
  getItem: jest.fn(async () => null),
}));

import {
  DEFAULT_NOTIFICATION_PREFS,
  KNOWN_NOTIFICATION_SOURCES,
  NOTIFICATION_CATEGORY_KEYS,
  NOTIFICATION_PREF_KEYS,
  applyPrefToggle,
  isPrefEffective,
  knownSourcesCoveredByPrefs,
  parseNotificationPrefs,
  prefKeyForSource,
  prefsFromDbRow,
  prefsToDbRow,
  shouldDeliverNotification,
} from '../../lib/notificationPrefs';
import {
  getGroupMuted,
  hydrateGroupMute,
  resetGroupMuteStore,
  setGroupMuted,
} from '../../lib/notificationGroupMute';

describe('notificationPrefs keys cover known sources', () => {
  it('maps every live push source to a prefs key', () => {
    expect(knownSourcesCoveredByPrefs()).toBe(true);
    for (const source of KNOWN_NOTIFICATION_SOURCES) {
      expect(prefKeyForSource(source)).not.toBeNull();
    }
  });

  it('does not invent category keys beyond the store', () => {
    for (const key of NOTIFICATION_CATEGORY_KEYS) {
      expect(NOTIFICATION_PREF_KEYS).toContain(key);
    }
  });

  it('round-trips db columns for the new IA sources', () => {
    const prefs = parseNotificationPrefs({
      notifications: true,
      communityNotifications: false,
      darkPoolNotifications: false,
      darkPoolTickerAlerts: true,
      watchlistNotifications: false,
    });
    const row = prefsToDbRow(prefs, 'user-1');
    expect(row.community_notifications).toBe(false);
    expect(row.dark_pool_notifications).toBe(false);
    expect(row.dark_pool_ticker_alerts).toBe(true);
    expect(row.watchlist_notifications).toBe(false);
    expect(prefsFromDbRow(row).communityNotifications).toBe(false);
    expect(prefsFromDbRow(row).darkPoolNotifications).toBe(false);
  });
});

describe('master-off disables children', () => {
  it('blocks every category when the master switch is off', () => {
    const prefs = applyPrefToggle(DEFAULT_NOTIFICATION_PREFS, 'notifications', false);
    for (const key of NOTIFICATION_CATEGORY_KEYS) {
      expect(prefs[key]).toBe(true);
      expect(isPrefEffective(prefs, key)).toBe(false);
    }
    for (const source of KNOWN_NOTIFICATION_SOURCES) {
      expect(shouldDeliverNotification(prefs, source)).toBe(false);
    }
  });

  it('still honors a child off when master is on', () => {
    const prefs = applyPrefToggle(DEFAULT_NOTIFICATION_PREFS, 'darkPoolNotifications', false);
    expect(isPrefEffective(prefs, 'darkPoolNotifications')).toBe(false);
    expect(shouldDeliverNotification(prefs, 'dark_pool_person_trade')).toBe(false);
    expect(shouldDeliverNotification(prefs, 'chat_message')).toBe(true);
  });

  it('keeps sound/vibration as device prefs, not delivery children', () => {
    const prefs = applyPrefToggle(DEFAULT_NOTIFICATION_PREFS, 'notifications', false);
    expect(isPrefEffective(prefs, 'sound')).toBe(true);
    expect(isPrefEffective(applyPrefToggle(prefs, 'sound', false), 'sound')).toBe(false);
  });
});

describe('group mute syncs with settings store', () => {
  beforeEach(() => {
    resetGroupMuteStore();
  });

  it('settings write is what group-info reads', async () => {
    const persist = jest.fn(async () => ({ success: true }));
    await setGroupMuted('g1', true, persist);
    expect(getGroupMuted('g1')).toBe(true);
    expect(persist).toHaveBeenCalledWith('g1', true);

    await setGroupMuted('g1', false, persist);
    expect(getGroupMuted('g1', true)).toBe(false);
  });

  it('hydrate does not hide a settings write with a stale group page', () => {
    hydrateGroupMute('g1', true, { overwrite: true });
    hydrateGroupMute('g1', false);
    expect(getGroupMuted('g1')).toBe(true);
  });

  it('reverts the shared store when persist fails', async () => {
    hydrateGroupMute('g1', false, { overwrite: true });
    const persist = jest.fn(async () => ({ success: false }));
    const result = await setGroupMuted('g1', true, persist);
    expect(result.success).toBe(false);
    expect(getGroupMuted('g1')).toBe(false);
  });
});
