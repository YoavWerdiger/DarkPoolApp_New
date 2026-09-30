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
  mergeUnpersistedAlertChoices,
  prefsFromDbRow,
  prefsToDbRow,
  shouldDeliverNotification,
} from '../../lib/notificationPrefs';
import {
  earningsUserWantsTicker,
  economicTitleMatchesKeys,
  resolveAlertScope,
  watchlistUserWantsSymbol,
} from '../../lib/notificationAlertScope';
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
    expect(row.insider_feed_alerts).toBe(false);
    expect(row.dark_pool_ticker_alerts).toBe(true);
    expect(row.watchlist_notifications).toBe(false);
    expect(prefsFromDbRow(row).communityNotifications).toBe(false);
    expect(prefsFromDbRow(row).darkPoolNotifications).toBe(false);
  });

  it('defaults alert scope to all only when that category is already on', () => {
    expect(resolveAlertScope(undefined, true)).toBe('all');
    expect(resolveAlertScope(undefined, false)).toBe('selected');
    expect(parseNotificationPrefs({ earningsNotifications: true }).earningsAlertScope).toBe('all');
    expect(parseNotificationPrefs({ earningsNotifications: false }).earningsAlertScope).toBe('selected');
    expect(parseNotificationPrefs({ watchlistNotifications: true }).watchlistAlertScope).toBe('all');
    expect(parseNotificationPrefs({ watchlistNotifications: false }).watchlistAlertScope).toBe(
      'selected',
    );
    expect(parseNotificationPrefs({ economicCalendarNotifications: false }).economicAlertScope).toBe(
      'selected',
    );
    expect(
      parseNotificationPrefs({ earningsNotifications: false, earningsAlertScope: 'all' })
        .earningsAlertScope,
    ).toBe('all');
  });

  it('keeps a selected earnings ticker list and matches economic titles', () => {
    const prefs = parseNotificationPrefs({
      earningsNotifications: true,
      earningsAlertScope: 'selected',
      earningsAlertSymbols: ['aapl', 'AAPL', 'nvda'],
      economicAlertIndicators: ['cpi', 'nope'],
    });
    expect(prefs.earningsAlertSymbols).toEqual(['AAPL', 'NVDA']);
    expect(prefs.economicAlertIndicators).toEqual(['cpi']);
    const row = prefsToDbRow(prefs, 'user-1');
    expect(row.earnings_alert_scope).toBe('selected');
    expect(row.earnings_alert_symbols).toEqual(['AAPL', 'NVDA']);
    expect(earningsUserWantsTicker('selected', prefs.earningsAlertSymbols, 'nvda')).toBe(true);
    expect(earningsUserWantsTicker('selected', prefs.earningsAlertSymbols, 'tsla')).toBe(false);
    expect(earningsUserWantsTicker('all', [], 'tsla')).toBe(true);
    expect(row.watchlist_alert_scope).toBe('all');
    expect(row.watchlist_alert_symbols).toBeNull();
    expect(row).not.toHaveProperty('news_sound');
    expect(row).not.toHaveProperty('recording_sound');
    expect(watchlistUserWantsSymbol('all', [], 'TSLA')).toBe(true);
    expect(watchlistUserWantsSymbol('selected', null, 'TSLA')).toBe(true);
    expect(watchlistUserWantsSymbol('selected', ['AAPL', 'nvda'], 'nvda')).toBe(true);
    expect(watchlistUserWantsSymbol('selected', ['AAPL'], 'tsla')).toBe(false);
    expect(economicTitleMatchesKeys('US CPI YoY', ['cpi'])).toBe(true);
    expect(economicTitleMatchesKeys('US CPI YoY', ['gdp'])).toBe(false);
  });

  it('keeps a device choice when the server row never stored it', () => {
    const local = parseNotificationPrefs({
      earningsNotifications: true,
      earningsAlertScope: 'selected',
      earningsAlertSymbols: ['NVDA'],
      watchlistNotifications: true,
      watchlistAlertScope: 'selected',
      watchlistAlertSymbols: ['AAPL'],
      economicCalendarNotifications: true,
      economicAlertScope: 'selected',
      economicAlertIndicators: ['cpi'],
    });
    const missingColumns = prefsFromDbRow({
      earnings_notifications: true,
      watchlist_notifications: true,
      economic_calendar_notifications: true,
    });
    const recovered = mergeUnpersistedAlertChoices(missingColumns, local, {
      earnings_notifications: true,
      watchlist_notifications: true,
      economic_calendar_notifications: true,
    });
    expect(recovered.earningsAlertScope).toBe('selected');
    expect(recovered.earningsAlertSymbols).toEqual(['NVDA']);
    expect(recovered.watchlistAlertScope).toBe('selected');
    expect(recovered.watchlistAlertSymbols).toEqual(['AAPL']);
    expect(recovered.economicAlertScope).toBe('selected');
    expect(recovered.economicAlertIndicators).toEqual(['cpi']);

    const migrationDefault = prefsFromDbRow({
      earnings_notifications: true,
      earnings_alert_scope: 'all',
      earnings_alert_symbols: [],
      watchlist_notifications: true,
      watchlist_alert_scope: 'all',
      watchlist_alert_symbols: null,
      economic_calendar_notifications: true,
      economic_alert_scope: 'all',
      economic_alert_indicators: [],
    });
    const fromDefault = mergeUnpersistedAlertChoices(migrationDefault, local, {
      earnings_alert_scope: 'all',
      earnings_alert_symbols: [],
      watchlist_alert_scope: 'all',
      watchlist_alert_symbols: null,
      economic_alert_scope: 'all',
      economic_alert_indicators: [],
    });
    expect(fromDefault.earningsAlertScope).toBe('selected');
    expect(fromDefault.watchlistAlertSymbols).toEqual(['AAPL']);
    expect(fromDefault.economicAlertIndicators).toEqual(['cpi']);

    const stored = mergeUnpersistedAlertChoices(
      parseNotificationPrefs({
        earningsNotifications: true,
        earningsAlertScope: 'selected',
        earningsAlertSymbols: ['TSLA'],
      }),
      local,
      {
        earnings_alert_scope: 'selected',
        earnings_alert_symbols: ['TSLA'],
      },
    );
    expect(stored.earningsAlertScope).toBe('selected');
    expect(stored.earningsAlertSymbols).toEqual(['TSLA']);
  });
});

describe('master-off disables children', () => {
  it('blocks every category when the master switch is off', () => {
    const prefs = applyPrefToggle(DEFAULT_NOTIFICATION_PREFS, 'notifications', false);
    for (const key of NOTIFICATION_CATEGORY_KEYS) {
      if (key === 'insiderFeedAlerts') {
        expect(prefs[key]).toBe(false);
      } else {
        expect(prefs[key]).toBe(true);
      }
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
    expect(shouldDeliverNotification(DEFAULT_NOTIFICATION_PREFS, 'dark_pool_feed_trade')).toBe(false);
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
