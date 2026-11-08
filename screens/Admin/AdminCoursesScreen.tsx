import i18n from '../../lib/i18n';
/**
 * פאנל מנהלים — ניהול האקדמיה: רשימת כל הקורסים (כולל מוסתרים), יצירת קורס חדש,
 * וכניסה לעריכת קורס ושיעוריו (AdminCourseEdit).
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../../components/ui/appType';
import UIButton from '../../components/ui/UIButton';
import { AdminBadge, AdminEmptyState, AdminSurface } from '../../components/admin';
import { adminService, type AdminCourse } from '../../services/admin';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { dirIcon } from '../../lib/i18n/direction';

export default function AdminCoursesScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // אורך אמיתי לכל השיעורים — מ-Vimeo / YouTube (במקום דקות שהוזנו ידנית / מהדמו)
  const syncDurations = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await adminService.syncLessonDurations();
      void HapticFeedback.success();
      legacyAlert(i18n.t('auto.screens__Admin__AdminCoursesScreen.s10'), i18n.t('auto.screens__Admin__AdminCoursesScreen.s11', { v0: r.updated, v1: r.total, v2: r.failed.length }));
      void load();
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCoursesScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCoursesScreen.s2'));
    } finally {
      setSyncing(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await adminService.listCourses();
      setCourses(res.courses);
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCoursesScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCoursesScreen.s2'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // רענון בכל חזרה למסך (אחרי עריכת קורס)
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const createCourse = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { course } = await adminService.upsertCourse({ title: i18n.t('auto.screens__Admin__AdminCoursesScreen.s3') });
      void HapticFeedback.success();
      navigation.navigate('AdminCourseEdit', { courseId: course.id });
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCoursesScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCoursesScreen.s4'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title={i18n.t('auto.screens__Admin__AdminCoursesScreen.s5')} onBack={() => navigation.goBack()} />
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
          <UIButton title={i18n.t('auto.screens__Admin__AdminCoursesScreen.s3')} variant="primary" fullWidth loading={creating} onPress={() => void createCourse()} style={styles.newBtn} />
          <UIButton title={i18n.t('auto.screens__Admin__AdminCoursesScreen.s12')} variant="secondary" fullWidth loading={syncing} onPress={() => void syncDurations()} style={styles.newBtn} />
          {courses.length === 0 ? (
            <AdminEmptyState title={i18n.t('auto.screens__Admin__AdminCoursesScreen.s6')} subtitle={i18n.t('auto.screens__Admin__AdminCoursesScreen.s7')} />
          ) : (
            <AdminSurface>
              {courses.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    void HapticFeedback.selection();
                    navigation.navigate('AdminCourseEdit', { courseId: c.id });
                  }}
                  accessibilityRole="button"
                >
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} /> : null}
                  <View style={styles.row}>
                    {c.cover_url ? (
                      <Image source={{ uri: c.cover_url }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback, { backgroundColor: tokens.colors.background.tertiary }]}>
                        <Ionicons name="school-outline" size={20} color={tokens.colors.text.secondary} />
                      </View>
                    )}
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={[styles.rowMeta, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                        {c.lessons_count ?? 0} {i18n.t('auto.screens__Admin__AdminCoursesScreen.s8')}{c.instructor_name ? ` · ${c.instructor_name}` : ''}
                      </Text>
                    </View>
                    {c.is_active ? null : <AdminBadge label={i18n.t('auto.screens__Admin__AdminCoursesScreen.s9')} color={tokens.colors.text.secondary} />}
                    <Ionicons name={dirIcon('chevron-back')} size={18} color={tokens.colors.text.tertiary} />
                  </View>
                </Pressable>
              ))}
            </AdminSurface>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: APP_LAYOUT.screenPaddingHorizontal, paddingBottom: 48, gap: APP_LAYOUT.componentGap },
  newBtn: { marginBottom: 4 },
  divider: { height: 1, marginHorizontal: APP_LAYOUT.cardPadding },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  cover: { width: 44, height: 44, borderRadius: 12 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...APP_TYPE.cardTitle, ...appPhysicalRightText },
  rowMeta: { ...APP_TYPE.cardSubtitle, ...appPhysicalRightText },
});
