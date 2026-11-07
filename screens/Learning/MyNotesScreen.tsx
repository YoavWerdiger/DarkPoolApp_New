import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { appLocale } from '../../lib/i18n/locale';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { learningProgressService } from '../../services/learningProgressService';
import { useAuth } from '../../context/AuthContext';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { AcademySubScreenBar } from '../../components/learning';
import UICard from '../../components/ui/UICard';
import { SkeletonLine } from '../../components/ui/SkeletonLoader';
import { ScreenChrome } from '../../components/ui';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import * as Clipboard from 'expo-clipboard';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ACADEMY_CARD_HP, ACADEMY_CARD_RADIUS } from '../../components/learning/academyCardLayout';
import {
  ACADEMY_TYPE,
  academyCardSubtitleStyle,
  academyCardTitleStyle,
} from '../../components/learning/academyLayout';
import { APP_LAYOUT } from '../../components/ui/appLayout';

interface NoteWithDetails {
  id?: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  notes_content: string;
  created_at?: string;
  updated_at?: string;
  course_title?: string;
  lesson_title?: string;
  thumbnail_url?: string;
}

export const MyNotesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();

  const [notes, setNotes] = useState<NoteWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const userNotes = await learningProgressService.getAllUserNotes(user.id);
      setNotes(userNotes);
    } catch {
      /* noop */
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useAfterNavigationTransition(() => {
    void loadNotes();
  }, [loadNotes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotes();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadNotes]);

  const handleNotePress = useCallback(
    (note: NoteWithDetails) => {
      void HapticFeedback.impactLight();
      (navigation as { navigate: (n: string, p: object) => void }).navigate('LearningScreen', {
        courseId: note.course_id,
        lessonId: note.lesson_id,
      });
    },
    [navigation]
  );

  const handleCopyNote = useCallback(async (note: NoteWithDetails) => {
    try {
      await Clipboard.setStringAsync(note.notes_content);
      void HapticFeedback.selection();
      legacyAlert(i18n.t('auto.screens__Learning__MyNotesScreen.s1'), i18n.t('auto.screens__Learning__MyNotesScreen.s2'));
    } catch {
      legacyAlert(i18n.t('auto.screens__Learning__MyNotesScreen.s3'), i18n.t('auto.screens__Learning__MyNotesScreen.s4'));
    }
  }, []);

  const renderNote = useCallback(
    ({ item }: { item: NoteWithDetails }) => {
      const dateLabel = item.updated_at
        ? new Date(item.updated_at).toLocaleDateString(appLocale())
        : null;

      return (
        <TouchableOpacity
          onPress={() => handleNotePress(item)}
          activeOpacity={0.88}
          style={styles.noteWrap}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('auto.screens__Learning__MyNotesScreen.s5', {
            v0: item.lesson_title || i18n.t('auto.screens__Learning__MyNotesScreen.s7'),
          })}
        >
          {/* אותו כרטיס כמו כרטיסי הקורסים באקדמיה */}
          <UICard variant="soft" padding="md" style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <View style={styles.noteInfo}>
                <Text style={styles.noteCourseTitle} numberOfLines={1}>
                  {item.course_title || i18n.t('auto.screens__Learning__MyNotesScreen.s6')}
                </Text>
                <Text style={styles.noteLessonTitle} numberOfLines={1}>
                  {item.lesson_title || i18n.t('auto.screens__Learning__MyNotesScreen.s7')}
                </Text>
              </View>

              <DayNavBlurButton
                size={36}
                glass
                glassIntensity="subtle"
                accessibilityLabel={i18n.t('auto.screens__Learning__MyNotesScreen.s8')}
                onPress={() => void handleCopyNote(item)}
                style={styles.copyBtn}
              >
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={DesignTokens.colors.text.primary}
                />
              </DayNavBlurButton>
            </View>

            <Text style={styles.noteContent} numberOfLines={3}>
              {item.notes_content}
            </Text>

            {dateLabel ? (
              <Text style={styles.noteDate}>{i18n.t('auto.screens__Learning__MyNotesScreen.s9', { v0: dateLabel })}</Text>
            ) : null}
          </UICard>
        </TouchableOpacity>
      );
    },
    [styles, DesignTokens, handleNotePress, handleCopyNote]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name="book-outline"
          size={40}
          color={DesignTokens.colors.text.tertiary}
        />
      </View>
      <Text style={styles.emptyTitle}>{i18n.t('auto.screens__Learning__MyNotesScreen.s10')}</Text>
      <Text style={styles.emptySubtitle}>{i18n.t('auto.screens__Learning__MyNotesScreen.s11', { v0: '\n' })}</Text>
    </View>
  );

  return (
    <ScreenChrome>
      <SafeAreaView edges={['top']} style={styles.safeAreaContainer}>
        {/* הכותרת וכפתור החזרה גם בזמן טעינה — כמו שאר מסכי המשנה */}
        <AcademySubScreenBar
          onBackPress={() => navigation.goBack()}
          title={i18n.t('auto.screens__Learning__MyNotesScreen.s13')}
          subtitle={
            isLoading ? undefined : i18n.t('auto.screens__Learning__MyNotesScreen.s14', { v0: notes.length })
          }
        />

        {isLoading ? (
          // כרטיסי הערה בטעינה — אותו כרטיס, ריפוד ושורות כמו renderNote; כפתור ההעתקה אמיתי
          <View style={styles.listContainer} pointerEvents="none">
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.noteWrap}>
                <UICard variant="soft" padding="md" style={styles.noteCard}>
                  <View style={styles.noteHeader}>
                    <View style={styles.noteInfo}>
                      <SkeletonLine lineHeight={Number(styles.noteCourseTitle.lineHeight) || 22} width={[150, 120, 170][i]} box={14} align="flex-end" />
                      <SkeletonLine lineHeight={Number(styles.noteLessonTitle.lineHeight) || 18} width={[110, 140, 96][i]} box={11} align="flex-end" />
                    </View>
                    <DayNavBlurButton size={36} glass glassIntensity="subtle" style={styles.copyBtn}>
                      <Ionicons name="copy-outline" size={16} color={DesignTokens.colors.text.primary} />
                    </DayNavBlurButton>
                  </View>
                  {(['100%', '92%', '58%'] as const).map((w) => (
                    <SkeletonLine key={w} lineHeight={Number(styles.noteContent.lineHeight) || 22} width={w} box={12} align="flex-end" />
                  ))}
                  <SkeletonLine
                    lineHeight={Number(styles.noteDate.lineHeight) || 16}
                    width={84}
                    box={10}
                    align="flex-end"
                    style={{ marginTop: APP_LAYOUT.stackGapSmall }}
                  />
                </UICard>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.listShell, { marginBottom: Math.max(0, mainTabsHeight - 12) }]}>
            <FlatList
              data={notes}
              renderItem={renderNote}
              keyExtractor={(item, index) => item.id || `note-${index}`}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={renderEmptyState}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={DesignTokens.colors.primary.main}
                />
              }
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </SafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    safeAreaContainer: {
      flex: 1,
    },
    listShell: {
      flex: 1,
    },
    listContainer: {
      paddingHorizontal: ACADEMY_CARD_HP,
      paddingTop: tokens.spacing.sm,
      paddingBottom: tokens.spacing['5xl'],
      flexGrow: 1,
    },
    noteWrap: {
      marginBottom: APP_LAYOUT.cardStackGap,
    },
    noteCard: {
      borderRadius: ACADEMY_CARD_RADIUS,
      overflow: 'hidden',
      borderWidth: 0,
    },
    noteHeader: {
      // מימין לשמאל: טקסט → העתק
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      marginBottom: tokens.spacing.sm,
    },
    noteInfo: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      gap: 2,
    },
    copyBtn: {
      flexShrink: 0,
    },
    noteCourseTitle: {
      ...academyCardTitleStyle,
      color: tokens.colors.text.primary,
    },
    noteLessonTitle: {
      ...academyCardSubtitleStyle,
      marginTop: 0,
    },
    noteContent: {
      ...ACADEMY_TYPE.cardBody,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
    },
    noteDate: {
      marginTop: APP_LAYOUT.stackGapSmall,
      ...ACADEMY_TYPE.caption,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: tokens.spacing['5xl'],
      paddingHorizontal: tokens.spacing.xl,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 1,
      borderColor: tokens.colors.border.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyTitle: {
      ...ACADEMY_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
  });
