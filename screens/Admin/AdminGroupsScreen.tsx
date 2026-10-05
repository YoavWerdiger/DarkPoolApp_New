import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { ChatSheetTopoHeader, useChatFitContentSnap } from '../../components/chat/ChatBottomSheet';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { AdminBadge, AdminEmptyState, AdminSurface } from '../../components/admin';
import { adminService, type AdminChatGroup, type AdminGroupMember } from '../../services/admin';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import { ANNOUNCEMENTS_GROUP_ID } from '../../utils/isAnnouncementGroup';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Tier = 'free' | 'premium';
const TIER_LABEL: Record<Tier, string> = { free: 'חינמי', premium: 'פרימיום' };

function groupTiers(g: AdminChatGroup): Tier[] {
  const t = g.settings?.allowed_tiers;
  return Array.isArray(t) && t.length > 0 ? t : ['free', 'premium'];
}
function groupAdminsOnly(g: AdminChatGroup): boolean {
  return !!(g.settings?.onlyAdminsCanSend || g.settings?.is_announcement);
}

/**
 * פאנל מנהלים — ניהול קבוצות: מי כותב, אילו מסלולים רואים ומצטרפים,
 * חברים (אדמין / חבר / הסרה), שינוי שם ומחיקה.
 */
export default function AdminGroupsScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const [groups, setGroups] = useState<AdminChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<AdminChatGroup | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminService.listGroups();
      setGroups(res.groups);
    } catch (e) {
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'טעינה נכשלה');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title="ניהול קבוצות" onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.text.secondary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {groups.length === 0 ? (
            <AdminEmptyState title="אין קבוצות" subtitle="קבוצות שנוצרות בקהילה יופיעו כאן" />
          ) : (
            <AdminSurface>
              {groups.map((g, i) => {
                const avatar = groupAvatarSource(g.name, g.avatar_url ?? undefined, isDarkMode);
                const tiers = groupTiers(g);
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      void HapticFeedback.selection();
                      setEditing(g);
                    }}
                    accessibilityRole="button"
                  >
                    {i > 0 ? <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} /> : null}
                    <View style={styles.row}>
                      {avatar ? (
                        <Image source={avatar} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tokens.colors.background.tertiary }]}>
                          <Ionicons name="people" size={20} color={tokens.colors.text.secondary} />
                        </View>
                      )}
                      <View style={styles.rowText}>
                        <Text style={[styles.rowTitle, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                          {chatGroupDisplayName(g.name)}
                        </Text>
                        <Text style={[styles.rowMeta, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                          {(g.members_count ?? 0).toLocaleString('he-IL')} חברים ·{' '}
                          {groupAdminsOnly(g) ? 'רק אדמינים כותבים' : 'כולם כותבים'} ·{' '}
                          {tiers.map((t) => TIER_LABEL[t]).join(' + ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-back" size={18} color={tokens.colors.text.tertiary} />
                    </View>
                  </Pressable>
                );
              })}
            </AdminSurface>
          )}
        </ScrollView>
      )}

      <GroupEditSheet
        group={editing}
        onClose={() => setEditing(null)}
        onChanged={() => void load()}
      />
    </SafeAreaView>
  );
}

function GroupEditSheet({
  group,
  onClose,
  onChanged,
}: {
  group: AdminChatGroup | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const visible = !!group;
  // שומרים את האחרונה כדי שהתוכן לא ייעלם באמצע אנימציית הסגירה
  const [last, setLast] = useState<AdminChatGroup | null>(null);
  useEffect(() => {
    if (group) setLast(group);
  }, [group]);
  const g = group ?? last;

  const [name, setName] = useState('');
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>(['free', 'premium']);
  const [members, setMembers] = useState<AdminGroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  useEffect(() => {
    if (!group) return;
    setName(chatGroupDisplayName(group.name));
    setAdminsOnly(groupAdminsOnly(group));
    setTiers(groupTiers(group));
    setMembers([]);
    setMembersLoading(true);
    adminService
      .listGroupMembers(group.id)
      .then((r) => setMembers(r.members))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [group]);

  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.8, 0.92, 0.4, `${g?.id}-${visible}`);
  const isAnnouncements = g?.id === ANNOUNCEMENTS_GROUP_ID;

  const dirty = useMemo(() => {
    if (!g) return false;
    return (
      name.trim() !== chatGroupDisplayName(g.name) ||
      adminsOnly !== groupAdminsOnly(g) ||
      tiers.slice().sort().join() !== groupTiers(g).slice().sort().join()
    );
  }, [g, name, adminsOnly, tiers]);

  const save = async () => {
    if (!g || !dirty || saving) return;
    if (tiers.length === 0) {
      legacyAlert('שגיאה', 'צריך לבחור לפחות מסלול אחד');
      return;
    }
    setSaving(true);
    try {
      await adminService.updateGroup(g.id, {
        name: name.trim() !== chatGroupDisplayName(g.name) ? name.trim() : undefined,
        adminsOnly,
        allowedTiers: tiers,
      });
      void HapticFeedback.success();
      onChanged();
      onClose();
    } catch (e) {
      void HapticFeedback.error();
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'שמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const memberActions = (m: AdminGroupMember) => {
    if (!g) return;
    const label = m.user?.display_name || m.user?.full_name || m.user?.email || 'משתמש';
    const isAdmin = m.role === 'admin' || m.role === 'owner';
    void HapticFeedback.selection();
    legacyAlert(label, isAdmin ? 'אדמין בקבוצה' : 'חבר בקבוצה', [
      {
        text: isAdmin ? 'הפוך לחבר רגיל' : 'הפוך לאדמין בקבוצה',
        onPress: async () => {
          try {
            await adminService.setGroupMemberRole(g.id, m.user_id, isAdmin ? 'member' : 'admin');
            setMembers((prev) =>
              prev.map((x) => (x.user_id === m.user_id ? { ...x, role: isAdmin ? 'member' : 'admin' } : x)),
            );
            void HapticFeedback.success();
          } catch (e) {
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
          }
        },
      },
      ...(isAnnouncements
        ? []
        : [
            {
              text: 'הסר מהקבוצה',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await adminService.removeGroupMember(g.id, m.user_id);
                  setMembers((prev) => prev.filter((x) => x.user_id !== m.user_id));
                  onChanged();
                } catch (e) {
                  legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
                }
              },
            },
          ]),
      { text: 'ביטול', style: 'cancel' as const },
    ]);
  };

  const confirmDelete = () => {
    if (!g) return;
    void HapticFeedback.warning();
    legacyAlert('מחיקת קבוצה', `למחוק את «${chatGroupDisplayName(g.name)}» וכל ההודעות בה? לא ניתן לבטל.`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteGroup(g.id);
            onChanged();
            onClose();
          } catch (e) {
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'מחיקה נכשלה');
          }
        },
      },
    ]);
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      avoidKeyboard
      contentPaddingBottom={0}
    >
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={onContentLayout}>
        <ChatSheetTopoHeader title={g ? chatGroupDisplayName(g.name) : ''} onClose={onClose} />

        <Text style={[formFieldLabelStyle({ tokens, focused: nameFocused }), styles.gapTop]}>שם הקבוצה</Text>
        <View style={[formFieldShellStyle({ tokens, focused: nameFocused }), styles.fieldShell]}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), appPhysicalRightText, styles.fieldInput]}
            maxLength={80}
          />
        </View>

        <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.gapTop]}>מי כותב בקבוצה</Text>
        <View style={[styles.segment, { backgroundColor: tokens.colors.background.cardSolid }]}>
          {([
            { key: false, label: 'כל החברים' },
            { key: true, label: 'רק אדמינים' },
          ] as const).map((opt) => {
            const active = adminsOnly === opt.key;
            return (
              <Pressable
                key={opt.label}
                onPress={() => {
                  if (!active) void HapticFeedback.selection();
                  setAdminsOnly(opt.key);
                }}
                style={[styles.segmentItem, active && { backgroundColor: tokens.colors.background.tertiary }]}
              >
                <Text style={[styles.chipText, { color: active ? tokens.colors.text.primary : tokens.colors.text.secondary }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.gapTop]}>מסלולים שרואים ומצטרפים</Text>
        <View style={styles.chipsRow}>
          {(['free', 'premium'] as Tier[]).map((t) => {
            const on = tiers.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() => {
                  void HapticFeedback.selection();
                  setTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
                }}
                style={[styles.chip, { backgroundColor: on ? tokens.colors.text.primary : tokens.colors.background.cardSolid }]}
              >
                <Ionicons name={on ? 'checkmark' : 'add'} size={16} color={on ? tokens.colors.text.inverse : tokens.colors.text.secondary} />
                <Text style={[styles.chipText, { color: on ? tokens.colors.text.inverse : tokens.colors.text.primary }]}>
                  {TIER_LABEL[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.gapTop]}>
          חברים{members.length ? ` (${members.length})` : ''}
        </Text>
        <View style={[styles.membersCard, { backgroundColor: tokens.colors.background.cardSolid }]}>
          {membersLoading ? (
            <ActivityIndicator style={{ paddingVertical: 20 }} color={tokens.colors.text.secondary} />
          ) : (
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {members.map((m, i) => {
                const label = m.user?.display_name || m.user?.full_name || m.user?.email || 'משתמש';
                const isAdmin = m.role === 'admin' || m.role === 'owner';
                return (
                  <Pressable key={m.user_id} onPress={() => memberActions(m)}>
                    {i > 0 ? <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} /> : null}
                    <View style={styles.memberRow}>
                      {m.user?.profile_picture ? (
                        <Image source={{ uri: m.user.profile_picture }} style={styles.memberAvatar} />
                      ) : (
                        <View style={[styles.memberAvatar, styles.avatarFallback, { backgroundColor: tokens.colors.background.tertiary }]}>
                          <Text style={{ color: tokens.colors.text.primary }}>{label.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={[styles.memberName, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                        {label}
                      </Text>
                      {isAdmin ? <AdminBadge label="אדמין" color={tokens.colors.text.primary} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.actions}>
          <UIButton title="שמור שינויים" variant="primary" fullWidth loading={saving} disabled={!dirty || saving} onPress={() => void save()} />
          {!isAnnouncements ? (
            <UIButton title="מחק קבוצה" variant="secondary" fullWidth onPress={confirmDelete} textStyle={{ color: tokens.colors.danger.main }} />
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingBottom: 40 },
  divider: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  rowMeta: {
    ...appPhysicalRightText,
    marginTop: 2,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
  },
  sheet: {
    direction: 'rtl',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: 4,
  },
  gapTop: { marginTop: APP_LAYOUT.componentGap },
  fieldShell: { borderRadius: 16, paddingHorizontal: APP_LAYOUT.cardPadding },
  fieldInput: { alignSelf: 'stretch', minHeight: 48 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 999 },
  chipText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
  membersCard: {
    borderRadius: UI_CARD_RADIUS,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    maxHeight: 260,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16 },
  memberName: {
    ...appPhysicalRightText,
    flex: 1,
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  actions: { gap: APP_LAYOUT.stackGapSmall, marginTop: APP_LAYOUT.sectionGap / 2 + 4 },
});
