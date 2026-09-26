import { legacyAlert } from '../../utils/appDialog';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { NotificationService } from '../../services/notificationService';
import { chatGroupService } from '../../services/chat';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  SettingsGlassCard,
  SettingsSwitchRow,
  SettingsActionRow,
  SettingsOutsideTitle,
} from '../../components/profile/ProfileSettingsUI';
import {
  settingsHebrewText,
  settingsBodyType,
  settingsMetaType,
} from '../../components/profile/settingsType';
import { useNotificationPrefs } from '../../hooks/useNotificationPrefs';
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

function openOsNotificationSettings() {
  if (Platform.OS === 'ios') {
    void Linking.openURL('app-settings:');
  } else {
    void Linking.openSettings();
  }
}

export default function NotificationsScreen({ navigation }: any) {
  const DesignTokens = useDesignTokens();
  const { prefs, loading, osGranted, osStatus, refreshOs, setPref, userId } =
    useNotificationPrefs();
  const [groups, setGroups] = useState<GroupMuteRow[]>([]);

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
    }, [reloadGroups, refreshOs]),
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
    if (!userId) return;
    void HapticFeedback.selection();
    const { success } = await setGroupMuted(groupId, muted, (id, next) =>
      chatGroupService.toggleGroupMute(id, userId, next),
    );
    if (!success) {
      legacyAlert('שגיאה', 'לא ניתן לשנות את השתקת הקבוצה');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text
          style={{
            ...settingsHebrewText,
            ...settingsBodyType,
            color: DesignTokens.colors.text.secondary,
            marginTop: 16,
          }}
        >
          טוען הגדרות...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
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
              paddingHorizontal: DesignTokens.spacing.lg,
              paddingTop: DesignTokens.spacing.lg,
              paddingBottom: DesignTokens.spacing['3xl'],
            }}
          >
            {!osGranted ? (
              <>
                <SettingsOutsideTitle title="הגדרות המכשיר" />
                <SettingsGlassCard>
                  <View
                    style={{
                      paddingHorizontal: DesignTokens.spacing.base,
                      paddingTop: DesignTokens.spacing.md,
                      paddingBottom: DesignTokens.spacing.sm,
                    }}
                  >
                    <Text
                      style={{
                        ...settingsHebrewText,
                        ...settingsMetaType,
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
                    subtitle="אפשר התראות ל-DarkPool במכשיר"
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
                subtitle="מאסטר לכל האפליקציה"
                value={osGranted && prefs.notifications}
                onValueChange={(v) => {
                  void handleMaster(v);
                }}
              />
              <SettingsSwitchRow
                title="צלילים"
                subtitle="צליל כשהתראה מגיעה"
                value={prefs.sound}
                disabled={!osGranted}
                onValueChange={(v) => {
                  void persistToggle('sound', v);
                }}
              />
              <SettingsSwitchRow
                title="רטט"
                subtitle="רטט בהתראות ובממשק"
                value={prefs.vibration}
                disabled={!osGranted}
                onValueChange={(v) => {
                  void persistToggle('vibration', v);
                }}
                showDivider={osGranted}
              />
              {osGranted ? (
                <SettingsActionRow
                  title="הגדרות המכשיר"
                  subtitle="ערוצי מערכת, צליל מערכת והרשאה"
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    openOsNotificationSettings();
                  }}
                  showDivider={false}
                />
              ) : null}
            </SettingsGlassCard>

            <SettingsOutsideTitle title="צ'אט" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="הודעות"
                subtitle="הודעות חדשות בקבוצות ובהודעות"
                value={isPrefEffective(prefs, 'messageNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('messageNotifications', v);
                }}
                showDivider={groups.length > 0}
              />
              {groups.map((group, index) => (
                <SettingsSwitchRow
                  key={group.id}
                  title={group.name}
                  subtitle={group.muted ? 'מושתק — כמו בפרטי הקבוצה' : 'השתק רק את הקבוצה הזו'}
                  value={group.muted}
                  onValueChange={(v) => {
                    void handleGroupMute(group.id, v);
                  }}
                  showDivider={index < groups.length - 1}
                />
              ))}
            </SettingsGlassCard>

            <SettingsOutsideTitle title="קהילה" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="תיוגים"
                subtitle="כשמישהו מזכיר אותך בציוץ"
                value={isPrefEffective(prefs, 'communityNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('communityNotifications', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsOutsideTitle title="דארק פול / אינסיידרים" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="אנשים במעקב"
                subtitle="עסקאות ודיווחי 13F של מי שעוקבים אחריו"
                value={isPrefEffective(prefs, 'darkPoolNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('darkPoolNotifications', v);
                }}
              />
              <SettingsSwitchRow
                title="זרימה על טיקרים"
                subtitle="סיגנלי Dark Pool לטיקרים במעקב"
                value={isPrefEffective(prefs, 'darkPoolTickerAlerts')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('darkPoolTickerAlerts', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsOutsideTitle title="שווקים / רשימה" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="התראות מחיר"
                subtitle="סף מחיר, שינוי יומי ודיווח ברשימת המעקב"
                value={isPrefEffective(prefs, 'watchlistNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('watchlistNotifications', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsOutsideTitle title="חדשות" />
            <SettingsGlassCard>
              <SettingsSwitchRow
                title="חדשות שוברות"
                subtitle="כותרות חשובות מהפיד"
                value={isPrefEffective(prefs, 'newsNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('newsNotifications', v);
                }}
              />
              <SettingsSwitchRow
                title="דיווחי רווח"
                subtitle="לפני ואחרי דוחות"
                value={isPrefEffective(prefs, 'earningsNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('earningsNotifications', v);
                }}
              />
              <SettingsSwitchRow
                title="יומן כלכלי"
                subtitle="אירועים כלכליים חשובים"
                value={isPrefEffective(prefs, 'economicCalendarNotifications')}
                disabled={childrenLocked}
                onValueChange={(v) => {
                  void handleCategory('economicCalendarNotifications', v);
                }}
                showDivider={false}
              />
            </SettingsGlassCard>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
