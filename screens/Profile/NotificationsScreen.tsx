import { legacyAlert } from '../../utils/appDialog';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { chatGroupDisplayName } from '../../assets/chatGroups/groupChatIcons';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { NotificationService } from '../../services/notificationService';
import { chatGroupService } from '../../services/chat';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  SettingsGlassCard,
  SettingsSwitchRow,
  SettingsActionRow,
  SettingsOutsideTitle,
  SettingsScopeChoice,
} from '../../components/profile/ProfileSettingsUI';
import {
  settingsHebrewText,
  settingsBodyType,
  settingsRowType,
} from '../../components/profile/settingsType';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { useNotificationPrefs } from '../../hooks/useNotificationPrefs';
import { ECONOMIC_ALERT_INDICATORS } from '../../lib/notificationAlertScope';
import { listUserWatchlistSymbols } from '../../services/watchlist/watchlistService';
import {
  isPrefEffective,
  type NotificationCategoryKey,
  type NotificationPrefKey,
} from '../../lib/notificationPrefs';
import {
  hydrateGroupMutes,
  loadGroupMuteMap,
  setGroupMuted,
  subscribeGroupMutes,
} from '../../lib/notificationGroupMute';

type GroupMuteRow = { id: string; name: string; muted: boolean };
type WatchTicker = { symbol: string; companyName: string | null };

function FollowedTickerRows({
  symbols,
  picked,
  disabled,
  onToggle,
}: {
  symbols: WatchTicker[];
  picked: string[] | null;
  disabled?: boolean;
  onToggle: (symbol: string, on: boolean) => void;
}) {
  const tokens = useDesignTokens();
  if (symbols.length === 0) {
    return (
      <View
        style={{
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingVertical: APP_LAYOUT.cardPadding,
        }}
      >
        <Text
          style={{
            ...settingsHebrewText,
            ...settingsBodyType,
            width: '100%',
            textAlign: 'right',
            color: tokens.colors.text.secondary,
          }}
        >
          אין סימולים ברשימת המעקב
        </Text>
      </View>
    );
  }
  return (
    <>
      {symbols.map((item, index) => (
        <SettingsSwitchRow
          key={item.symbol}
          title={item.symbol}
          value={picked == null || picked.includes(item.symbol)}
          disabled={disabled}
          showDivider={index < symbols.length - 1}
          onValueChange={(on) => onToggle(item.symbol, on)}
        />
      ))}
    </>
  );
}

function EarningsTickerPicker({
  symbols,
  disabled,
  onAdd,
  onRemove,
}: {
  symbols: string[];
  disabled?: boolean;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  const tokens = useDesignTokens();
  const [draft, setDraft] = useState('');

  const commitTicker = () => {
    const symbol = draft.trim().toUpperCase();
    setDraft('');
    if (!symbol || disabled || symbols.some((item) => item.toUpperCase() === symbol)) return;
    onAdd(symbol);
  };

  return (
    <View
      style={{
        paddingHorizontal: APP_LAYOUT.cardPadding,
        paddingVertical: APP_LAYOUT.cardPadding,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          paddingHorizontal: APP_LAYOUT.cardPadding,
          borderRadius: tokens.borderRadius.full,
          backgroundColor: tokens.colors.background.cardSolid,
          gap: APP_LAYOUT.stackGapSmall,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          editable={!disabled}
          onSubmitEditing={commitTicker}
          returnKeyType="done"
          blurOnSubmit
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          placeholder="חיפוש טיקר"
          placeholderTextColor={tokens.colors.text.muted}
          accessibilityLabel="חיפוש טיקר"
          underlineColorAndroid="transparent"
          style={{
            ...settingsHebrewText,
            ...settingsBodyType,
            flex: 1,
            textAlign: 'right',
            color: tokens.colors.text.primary,
            padding: 0,
            margin: 0,
          }}
        />
        <Search size={18} color={tokens.colors.text.secondary} strokeWidth={2} />
      </View>
      {symbols.length > 0 ? (
        <View
          style={{
            direction: 'ltr',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: APP_LAYOUT.stackGapSmall,
            marginTop: APP_LAYOUT.cardStackGap,
          }}
        >
          {symbols.map((symbol) => (
            <Pressable
              key={symbol}
              disabled={disabled}
              onPress={() => onRemove(symbol)}
              accessibilityRole="button"
              accessibilityLabel={`הסרת ${symbol}`}
              style={{
                direction: 'ltr',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                minHeight: 36,
                paddingVertical: 6,
                paddingLeft: 10,
                paddingRight: 12,
                borderRadius: tokens.borderRadius.full,
                backgroundColor: tokens.colors.background.primary,
              }}
            >
              <X size={14} color={tokens.colors.text.tertiary} strokeWidth={2} />
              <Text
                style={{
                  ...settingsHebrewText,
                  ...settingsRowType,
                  lineHeight: 20,
                  color: tokens.colors.text.primary,
                }}
              >
                {symbol}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function openOsNotificationSettings() {
  if (Platform.OS === 'ios') {
    void Linking.openURL('app-settings:');
  } else {
    void Linking.openSettings();
  }
}

export default function NotificationsScreen({ navigation }: any) {
  const DesignTokens = useDesignTokens();
  const { prefs, loading, osGranted, osStatus, refreshOs, setPref, patchPrefs, userId } =
    useNotificationPrefs();
  const [groups, setGroups] = useState<GroupMuteRow[]>([]);
  const [watchSymbols, setWatchSymbols] = useState<WatchTicker[]>([]);

  const reloadGroups = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      return;
    }
    await loadGroupMuteMap();
    const { data } = await chatGroupService.getChatGroups(userId);
    const rows = (data ?? []).map((g) => ({
      id: g.id,
      name: g.name?.trim() || "צ'אט",
      muted: !!g.is_muted,
    }));
    hydrateGroupMutes(
      rows.map((g) => ({ id: g.id, muted: g.muted })),
      { overwrite: true },
    );
    setGroups(rows);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void reloadGroups();
      void refreshOs();
      if (!userId) {
        setWatchSymbols([]);
        return;
      }
      void listUserWatchlistSymbols(userId)
        .then(setWatchSymbols)
        .catch(() => setWatchSymbols([]));
    }, [reloadGroups, refreshOs, userId]),
  );

  useEffect(
    () =>
      subscribeGroupMutes((id, muted) => {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, muted } : g)));
      }),
    [],
  );

  const childrenLocked = !osGranted || !prefs.notifications;

  const persistToggle = async (key: NotificationPrefKey, next: boolean) => {
    void HapticFeedback.selection();
    await setPref(key, next);
  };

  const handleMaster = async (value: boolean) => {
    void HapticFeedback.selection();
    if (!value) {
      await setPref('notifications', false);
      return;
    }

    const { status: current } = await Notifications.getPermissionsAsync();
    if (current !== 'granted') {
      const allowed = await NotificationService.requestPermissions(true);
      await refreshOs();
      if (!allowed) {
        await setPref('notifications', false);
        legacyAlert(
          'הרשאות התראות נדרשות',
          'כיבית את ההתראות בהגדרות המכשיר. אי אפשר להפעיל אותן מכאן — פתח את הגדרות המערכת.',
          [
            { text: 'ביטול', style: 'cancel' },
            { text: 'פתח הגדרות', onPress: openOsNotificationSettings },
          ],
        );
        return;
      }
    }

    await setPref('notifications', true);
    const registered = await NotificationService.registerDeviceToken();
    if (!registered) {
      const isSimulator = !require('expo-device').Device.isDevice;
      legacyAlert(
        'התראות הופעלו',
        isSimulator
          ? 'ההרשאות ניתנו. Push לא עובד בסימולטור — בדוק במכשיר אמיתי.'
          : 'ההרשאות ניתנו. אם הרישום נכשל, נסה שוב מאוחר יותר.',
        [{ text: 'אישור' }],
      );
    }
  };

  const handleCategory = async (key: NotificationCategoryKey, value: boolean) => {
    if (childrenLocked) return;
    await persistToggle(key, value);
  };

  const handleGroupMute = async (groupId: string, muted: boolean) => {
    if (!userId || childrenLocked) return;
    void HapticFeedback.selection();
    const { success } = await setGroupMuted(groupId, muted, (id, next) =>
      chatGroupService.toggleGroupMute(id, userId, next),
    );
    if (!success) {
      legacyAlert('שגיאה', 'לא ניתן לשנות את השתקת הקבוצה');
    }
  };

  const canvas = { flex: 1, backgroundColor: DesignTokens.colors.background.primary };

  if (loading) {
    return (
      <View style={[canvas, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text
          style={{
            ...settingsHebrewText,
            ...settingsBodyType,
            color: DesignTokens.colors.text.secondary,
            marginTop: APP_LAYOUT.componentGap,
          }}
        >
          טוען הגדרות...
        </Text>
      </View>
    );
  }

  return (
    <View style={canvas}>
      <RNSafeAreaView style={canvas} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="התראות"
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View
            style={{
              paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
              paddingTop: APP_LAYOUT.cardPadding,
              paddingBottom: DesignTokens.spacing.xl,
            }}
          >
            {!osGranted ? (
              <>
                <SettingsOutsideTitle title="הגדרות המכשיר" />
                <SettingsGlassCard>
                  <View
                    style={{
                      paddingHorizontal: APP_LAYOUT.cardPadding,
                      paddingVertical: APP_LAYOUT.cardPadding,
                    }}
                  >
                    <Text
                      style={{
                        ...settingsHebrewText,
                        ...settingsBodyType,
                        color: DesignTokens.colors.text.secondary,
                      }}
                    >
                      {osStatus === 'denied'
                        ? 'התראות חסומות בהגדרות המערכת. המתגים כאן לא ישלחו כלום עד שתאפשר גישה במכשיר.'
                        : 'עדיין לא אושרה הרשאת התראות. בלי אישור מערכת — המתגים לא באמת שולחים.'}
                    </Text>
                  </View>
                  <SettingsActionRow
                    title="פתח הגדרות מערכת"
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      openOsNotificationSettings();
                    }}
                    showDivider={false}
                  />
                </SettingsGlassCard>
              </>
            ) : null}

            <SettingsOutsideTitle title="כללי" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="התראות"
                value={osGranted && prefs.notifications}
                onValueChange={(v) => {
                  void handleMaster(v);
                }}
              />
              <SettingsSwitchRow
                title="רטט"
                value={prefs.vibration}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  if (childrenLocked) return;
                  void persistToggle('vibration', v);
                }}
                showDivider={osGranted}
              />
              {osGranted ? (
                <SettingsActionRow
                  title="הגדרות המכשיר"
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    openOsNotificationSettings();
                  }}
                  showDivider={false}
                />
              ) : null}
            </SettingsGlassCard>

            {groups.length > 0 ? (
              <>
                <SettingsOutsideTitle title="צ'אט" />
                <SettingsGlassCard>
                  {groups.map((group, index) => (
                    <SettingsSwitchRow
                      key={group.id}
                      title={chatGroupDisplayName(group.name)}
                      value={group.muted}
                      disabled={childrenLocked}
                      onValueChange={(v) => {
                        void handleGroupMute(group.id, v);
                      }}
                      showDivider={index < groups.length - 1}
                    />
                  ))}
                </SettingsGlassCard>
              </>
            ) : null}

            <SettingsOutsideTitle title="ציוצים" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="תיוגים"
                value={isPrefEffective(prefs, 'communityNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('communityNotifications', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsOutsideTitle title="אינסיידרים" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="פיד עסקאות"
                value={isPrefEffective(prefs, 'insiderFeedAlerts')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('insiderFeedAlerts', v);
                }}
              />
              <SettingsSwitchRow
                title="אנשים במעקב"
                value={isPrefEffective(prefs, 'darkPoolNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('darkPoolNotifications', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsOutsideTitle title="רשימת מעקב" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="התראות מחיר"
                value={isPrefEffective(prefs, 'watchlistNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('watchlistNotifications', v);
                }}
                showDivider={isPrefEffective(prefs, 'watchlistNotifications')}
              />
              {isPrefEffective(prefs, 'watchlistNotifications') ? (
                <>
                  <SettingsScopeChoice
                    value={prefs.watchlistAlertScope}
                    disabled={childrenLocked}
                    showDivider={prefs.watchlistAlertScope === 'selected'}
                    onChange={(scope) => {
                      void HapticFeedback.selection();
                      void patchPrefs({ watchlistAlertScope: scope });
                    }}
                  />
                  {prefs.watchlistAlertScope === 'selected' ? (
                    <FollowedTickerRows
                      symbols={watchSymbols}
                      picked={prefs.watchlistAlertSymbols}
                      disabled={childrenLocked}
                      onToggle={(symbol, on) => {
                        const base =
                          prefs.watchlistAlertSymbols ?? watchSymbols.map((item) => item.symbol);
                        const next = on
                          ? Array.from(new Set([...base, symbol]))
                          : base.filter((item) => item !== symbol);
                        void patchPrefs({ watchlistAlertSymbols: next });
                      }}
                    />
                  ) : null}
                </>
              ) : null}
            </SettingsGlassCard>

            <SettingsOutsideTitle title="חדשות" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="חדשות מתפרצות"
                value={isPrefEffective(prefs, 'newsNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('newsNotifications', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsOutsideTitle title="דיווחי רווח" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="התראות"
                value={isPrefEffective(prefs, 'earningsNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('earningsNotifications', v);
                }}
                showDivider={isPrefEffective(prefs, 'earningsNotifications')}
              />
              {isPrefEffective(prefs, 'earningsNotifications') ? (
                <>
                  <SettingsScopeChoice
                    value={prefs.earningsAlertScope}
                    disabled={childrenLocked}
                    showDivider={prefs.earningsAlertScope === 'selected'}
                    onChange={(scope) => {
                      void HapticFeedback.selection();
                      void patchPrefs({ earningsAlertScope: scope });
                    }}
                  />
                  {prefs.earningsAlertScope === 'selected' ? (
                    <EarningsTickerPicker
                      symbols={prefs.earningsAlertSymbols}
                      disabled={childrenLocked}
                      onAdd={(symbol) => {
                        if (childrenLocked || prefs.earningsAlertSymbols.includes(symbol)) return;
                        void HapticFeedback.selection();
                        void patchPrefs({
                          earningsAlertSymbols: [...prefs.earningsAlertSymbols, symbol],
                        });
                      }}
                      onRemove={(symbol) => {
                        if (childrenLocked) return;
                        void HapticFeedback.selection();
                        void patchPrefs({
                          earningsAlertSymbols: prefs.earningsAlertSymbols.filter(
                            (item) => item !== symbol,
                          ),
                        });
                      }}
                    />
                  ) : null}
                </>
              ) : null}
            </SettingsGlassCard>

            <SettingsOutsideTitle title="יומן כלכלי" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="התראות"
                value={isPrefEffective(prefs, 'economicCalendarNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('economicCalendarNotifications', v);
                }}
                showDivider={isPrefEffective(prefs, 'economicCalendarNotifications')}
              />
              {isPrefEffective(prefs, 'economicCalendarNotifications') ? (
                <>
                  <SettingsScopeChoice
                    value={prefs.economicAlertScope}
                    disabled={childrenLocked}
                    showDivider={prefs.economicAlertScope === 'selected'}
                    onChange={(scope) => {
                      void HapticFeedback.selection();
                      void patchPrefs({ economicAlertScope: scope });
                    }}
                  />
                  {prefs.economicAlertScope === 'selected'
                    ? ECONOMIC_ALERT_INDICATORS.map((indicator, index) => (
                        <SettingsSwitchRow
                          key={indicator.key}
                          title={indicator.title}
                          value={prefs.economicAlertIndicators.includes(indicator.key)}
                          disabled={childrenLocked}
                          showDivider={index < ECONOMIC_ALERT_INDICATORS.length - 1}
                          onValueChange={(on) => {
                            const next = on
                              ? [...prefs.economicAlertIndicators, indicator.key]
                              : prefs.economicAlertIndicators.filter((key) => key !== indicator.key);
                            void patchPrefs({ economicAlertIndicators: next });
                          }}
                        />
                      ))
                    : null}
                </>
              ) : null}
            </SettingsGlassCard>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
