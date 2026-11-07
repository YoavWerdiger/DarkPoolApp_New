import i18n from '../../lib/i18n';
/**
 * פאנל מנהלים — עריכת קורס: פרטי הקורס (שם, תת-כותרת, תיאור, מדריך, רמה, תמונה, פעיל/מוסתר)
 * וניהול השיעורים: הוספה, עריכה (שם, תיאור, משך, קישור יוטיוב), סידור מחדש, הסתרה ומחיקה.
 * כל הכתיבה דרך admin-api (בדיקת מנהל בשרת + יומן ביקורת).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { ChatSheetTopoHeader } from '../../components/chat/ChatBottomSheet';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import UIButton from '../../components/ui/UIButton';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { AdminBadge, AdminEmptyState, AdminSurface } from '../../components/admin';
import { adminService, type AdminCourse, type AdminLesson } from '../../services/admin';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Tokens = ReturnType<typeof useDesignTokens>;

/** שדה טקסט בסגנון הטופו — תווית מעל, מעטפת עם מסגרת פוקוס */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  ltr,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'url';
  ltr?: boolean;
}) {
  const tokens = useDesignTokens();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={formFieldLabelStyle({ tokens, focused })}>{label}</Text>
      <View style={[formFieldShellStyle({ tokens, focused, multiline }), styles.shell]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={formFieldPlaceholderColor(tokens)}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            formFieldInputStyle(tokens),
            ltr ? styles.ltrInput : appPhysicalRightText,
            multiline && styles.multiline,
          ]}
        />
      </View>
    </View>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.switchRow}>
      <AppSwitch value={value} onValueChange={onChange} />
      <Text style={[styles.switchLabel, { color: tokens.colors.text.primary }]}>{label}</Text>
    </View>
  );
}

const num = (v: string): number | null => {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return v.trim() && Number.isFinite(n) ? n : null;
};

export default function AdminCourseEditScreen({ navigation, route }: any) {
  const courseId: string = route.params?.courseId;
  const tokens = useDesignTokens();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLesson, setEditingLesson] = useState<AdminLesson | 'new' | null>(null);

  // טיוטת פרטי הקורס
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructor, setInstructor] = useState('');
  const [level, setLevel] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [active, setActive] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminService.getCourse(courseId);
      const c = res.course;
      setCourse(c);
      setLessons(res.lessons);
      setTitle(c.title ?? '');
      setSubtitle(c.subtitle ?? '');
      setDescription(c.description ?? '');
      setInstructor(c.instructor_name ?? '');
      setLevel(c.level ?? '');
      setCoverUrl(c.cover_url ?? '');
      setDurationHours(c.duration_hours != null ? String(c.duration_hours) : '');
      setActive(Boolean(c.is_active));
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s2'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!course) return false;
    return (
      title !== (course.title ?? '') ||
      subtitle !== (course.subtitle ?? '') ||
      description !== (course.description ?? '') ||
      instructor !== (course.instructor_name ?? '') ||
      level !== (course.level ?? '') ||
      coverUrl !== (course.cover_url ?? '') ||
      durationHours !== (course.duration_hours != null ? String(course.duration_hours) : '') ||
      active !== Boolean(course.is_active)
    );
  }, [course, title, subtitle, description, instructor, level, coverUrl, durationHours, active]);

  const saveCourse = async () => {
    if (!title.trim()) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s3'), i18n.t('auto.screens__Admin__AdminCourseEditScreen.s4'));
      return;
    }
    setSaving(true);
    try {
      const { course: saved } = await adminService.upsertCourse({
        id: courseId,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim(),
        instructor_name: instructor.trim(),
        level: level.trim(),
        cover_url: coverUrl.trim() || null,
        duration_hours: num(durationHours) ?? 0,
        is_active: active,
      });
      setCourse(saved);
      void HapticFeedback.success();
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s5'));
    } finally {
      setSaving(false);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const next = [...lessons];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setLessons(next.map((l, i) => ({ ...l, order_index: i + 1 })));
    void HapticFeedback.selection();
    try {
      await adminService.reorderLessons(courseId, next.map((l) => l.id));
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s6'));
      void load();
    }
  };

  const styles2 = useMemo(() => dynamicStyles(tokens), [tokens]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title={course?.title || i18n.t('auto.screens__Admin__AdminCourseEditScreen.s7')} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.colors.text.secondary} />
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
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
          <Text style={styles2.sectionTitle}>{i18n.t('auto.screens__Admin__AdminCourseEditScreen.s8')}</Text>
          <AdminSurface>
            <View style={styles.form}>
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s9')} value={title} onChangeText={setTitle} />
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s10')} value={subtitle} onChangeText={setSubtitle} />
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s11')} value={description} onChangeText={setDescription} multiline />
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s12')} value={instructor} onChangeText={setInstructor} />
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s13')} value={level} onChangeText={setLevel} placeholder={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s14')} />
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s15')} value={durationHours} onChangeText={setDurationHours} keyboardType="numeric" ltr />
              <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s16')} value={coverUrl} onChangeText={setCoverUrl} keyboardType="url" ltr placeholder="https://…" />
              <SwitchRow label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s17')} value={active} onChange={setActive} />
              <UIButton title={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s18')} variant="primary" fullWidth loading={saving} disabled={!dirty || saving} onPress={() => void saveCourse()} />
            </View>
          </AdminSurface>

          <View style={styles.lessonsHeader}>
            <Text style={styles2.sectionTitle}>{i18n.t('auto.screens__Admin__AdminCourseEditScreen.s19', { v0: lessons.length })}</Text>
          </View>
          <UIButton title={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s20')} variant="secondary" fullWidth onPress={() => setEditingLesson('new')} />
          {lessons.length === 0 ? (
            <AdminEmptyState title={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s21')} subtitle={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s22')} />
          ) : (
            <AdminSurface>
              {lessons.map((l, i) => (
                <View key={l.id}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} /> : null}
                  <View style={styles.lessonRow}>
                    <Text style={[styles.lessonIndex, { color: tokens.colors.text.secondary }]}>{i + 1}</Text>
                    <Pressable
                      style={styles.lessonText}
                      onPress={() => {
                        void HapticFeedback.selection();
                        setEditingLesson(l);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s23', { v0: l.title })}
                    >
                      <Text style={[styles.lessonTitle, { color: tokens.colors.text.primary }]} numberOfLines={2}>
                        {l.title}
                      </Text>
                      <View style={styles.lessonMetaRow}>
                        {l.has_vimeo ? (
                          <Ionicons name="logo-vimeo" size={14} color="#1AB7EA" />
                        ) : l.youtube_url ? (
                          <Ionicons name="logo-youtube" size={14} color="#FF0000" />
                        ) : (
                          <Text style={[styles.lessonMeta, { color: tokens.colors.text.danger }]}>{i18n.t('auto.screens__Admin__AdminCourseEditScreen.s24')}</Text>
                        )}
                        {l.duration_minutes ? (
                          <Text style={[styles.lessonMeta, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Admin__AdminCourseEditScreen.s25', { v0: l.duration_minutes })}</Text>
                        ) : null}
                        {l.is_active ? null : <AdminBadge label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s26')} color={tokens.colors.text.secondary} />}
                      </View>
                    </Pressable>
                    <View style={styles.reorder}>
                      <Pressable onPress={() => void move(i, -1)} disabled={i === 0} hitSlop={6} accessibilityLabel={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s27')}>
                        <Ionicons name="chevron-up" size={20} color={i === 0 ? tokens.colors.text.tertiary : tokens.colors.text.primary} />
                      </Pressable>
                      <Pressable onPress={() => void move(i, 1)} disabled={i === lessons.length - 1} hitSlop={6} accessibilityLabel={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s28')}>
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color={i === lessons.length - 1 ? tokens.colors.text.tertiary : tokens.colors.text.primary}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </AdminSurface>
          )}
        </KeyboardAwareScrollView>
      )}

      <LessonEditSheet
        courseId={courseId}
        lesson={editingLesson}
        onClose={() => setEditingLesson(null)}
        onChanged={() => void load()}
      />
    </SafeAreaView>
  );
}

function LessonEditSheet({
  courseId,
  lesson,
  onClose,
  onChanged,
}: {
  courseId: string;
  lesson: AdminLesson | 'new' | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tokens = useDesignTokens();
  const isNew = lesson === 'new';
  const current = lesson && lesson !== 'new' ? lesson : null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState('');
  const [youtube, setYoutube] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    setTitle(current?.title ?? '');
    setDescription(current?.description ?? '');
    setMinutes(current?.duration_minutes != null ? String(current.duration_minutes) : '');
    setYoutube(current?.youtube_url ?? '');
    setActive(current ? Boolean(current.is_active) : true);
  }, [lesson, current]);

  const save = async () => {
    if (!title.trim()) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s3'), i18n.t('auto.screens__Admin__AdminCourseEditScreen.s29'));
      return;
    }
    const url = youtube.trim();
    if (url && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(url)) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s30'), i18n.t('auto.screens__Admin__AdminCourseEditScreen.s31'));
      return;
    }
    setSaving(true);
    try {
      await adminService.upsertLesson(courseId, {
        ...(current ? { id: current.id } : {}),
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: num(minutes),
        is_active: active,
        // נוגעים במדיה רק כשהקישור השתנה (שמירת שם לא משנה וידאו קיים)
        ...(url !== (current?.youtube_url ?? '') ? { youtubeUrl: url || null } : {}),
      });
      void HapticFeedback.success();
      onChanged();
      onClose();
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s32'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!current) return;
    legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s33'), i18n.t('auto.screens__Admin__AdminCourseEditScreen.s34', { v0: current.title }), [
      { text: i18n.t('auto.screens__Admin__AdminCourseEditScreen.s35'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Admin__AdminCourseEditScreen.s36'),
        style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteLesson(courseId, current.id);
            void HapticFeedback.success();
            onChanged();
            onClose();
          } catch (e) {
            legacyAlert(i18n.t('auto.screens__Admin__AdminCourseEditScreen.s1'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s37'));
          }
        },
      },
    ]);
  };

  return (
    <BottomSheet
      isOpen={lesson != null}
      onClose={onClose}
      snapPoints={[0.9]}
      edgeToEdge
      showHandle
      enablePanDownToClose
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      contentPaddingBottom={0}
    >
      <View style={{ flex: 1, paddingHorizontal: tokens.layout.screenPadding }}>
        <ChatSheetTopoHeader title={isNew ? i18n.t('auto.screens__Admin__AdminCourseEditScreen.s38') : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s39')} onClose={onClose} />
        <KeyboardAwareScrollView contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled" bottomOffset={24}>
          <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s40')} value={title} onChangeText={setTitle} />
          <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s41')} value={description} onChangeText={setDescription} multiline />
          <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s42')} value={youtube} onChangeText={setYoutube} keyboardType="url" ltr placeholder="https://youtu.be/…" />
          <Field label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s43')} value={minutes} onChangeText={setMinutes} keyboardType="numeric" ltr />
          <SwitchRow label={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s44')} value={active} onChange={setActive} />
          <UIButton title={isNew ? i18n.t('auto.screens__Admin__AdminCourseEditScreen.s45') : i18n.t('auto.screens__Admin__AdminCourseEditScreen.s46')} variant="primary" fullWidth loading={saving} onPress={() => void save()} />
          {current ? (
            <UIButton title={i18n.t('auto.screens__Admin__AdminCourseEditScreen.s47')} variant="secondary" fullWidth onPress={remove} style={styles.deleteBtn} />
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </BottomSheet>
  );
}

function dynamicStyles(tokens: Tokens) {
  return StyleSheet.create({
    sectionTitle: {
      ...APP_TYPE.sectionTitle,
      ...appPhysicalRightText,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
  });
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: APP_LAYOUT.screenPaddingHorizontal, paddingBottom: 64, gap: APP_LAYOUT.componentGap },
  form: { padding: APP_LAYOUT.cardPadding, gap: 12 },
  field: { gap: 6 },
  shell: { paddingHorizontal: 14 },
  ltrInput: { textAlign: 'left', writingDirection: 'ltr' },
  multiline: { minHeight: 88 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { ...APP_TYPE.cardBody, ...appPhysicalRightText, flex: 1 },
  lessonsHeader: { marginTop: APP_LAYOUT.componentGap },
  divider: { height: 1, marginHorizontal: APP_LAYOUT.cardPadding },
  lessonRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  lessonIndex: { ...APP_TYPE.cardSubtitle, width: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  lessonText: { flex: 1, minWidth: 0, gap: 3 },
  lessonTitle: { ...APP_TYPE.cardBody, ...appPhysicalRightText, fontWeight: '600' },
  lessonMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  lessonMeta: { ...APP_TYPE.caption },
  reorder: { alignItems: 'center', gap: 2 },
  sheetScroll: { gap: 12, paddingBottom: 48, paddingTop: 4 },
  deleteBtn: { marginTop: 4 },
});
