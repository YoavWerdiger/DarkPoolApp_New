import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { learningProgressService } from '../../services/learningProgressService';
import { useAuth } from '../../context/AuthContext';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { AcademySubScreenBar } from '../../components/learning';
import UICard from '../../components/ui/UICard';
import { ScreenChrome } from '../../components/ui';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import * as Clipboard from 'expo-clipboard';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ACADEMY_CARD_HP, ACADEMY_CARD_RADIUS } from '../../components/learning/academyCardLayout';

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

  useEffect(() => {
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
      legacyAlert('הועתק', 'ההערה הועתקה ללוח');
    } catch {
      legacyAlert('שגיאה', 'לא ניתן להעתיק את ההערה');
    }
  }, []);

  const renderNote = useCallback(
    ({ item }: { item: NoteWithDetails }) => {
      const dateLabel = item.updated_at
        ? new Date(item.updated_at).toLocaleDateString('he-IL')
        : null;

      return (
        <TouchableOpacity
          onPress={() => handleNotePress(item)}
          activeOpacity={0.88}
          style={styles.noteWrap}
          accessibilityRole="button"
          accessibilityLabel={`הערה מ${item.lesson_title || 'שיעור'}`}
        >
          <UICard
            variant="blur"
            glassIntensity="subtle"
            padding="md"
            showGlassBorder={false}
            style={styles.noteCard}
          >
            <View style={styles.noteHeader}>
              <View style={styles.noteInfo}>
                <Text style={styles.noteCourseTitle} numberOfLines={1}>
                  {item.course_title || 'קורס ללא שם'}
                </Text>
                <Text style={styles.noteLessonTitle} numberOfLines={1}>
                  {item.lesson_title || 'שיעור ללא שם'}
                </Text>
              </View>

              <DayNavBlurButton
                size={36}
                glassIntensity="subtle"
                accessibilityLabel="העתק הערה"
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
              <Text style={styles.noteDate}>עודכן · {dateLabel}</Text>
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
          name="document-text-outline"
          size={40}
          color={DesignTokens.colors.text.tertiary}
        />
      </View>
      <Text style={styles.emptyTitle}>אין הערות עדיין</Text>
      <Text style={styles.emptySubtitle}>
        התחל לצפות בשיעורים וכתוב הערות{'\n'}
        כדי לראות אותן כאן
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenChrome withBrandWatermark>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={styles.loadingText}>טוען הערות...</Text>
        </View>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.safeAreaContainer}>
        <AcademySubScreenBar
          onBackPress={() => navigation.goBack()}
          title="ההערות שלי"
          subtitle={`${notes.length} הערות`}
        />

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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: tokens.spacing.md,
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.secondary,
    },
    listContainer: {
      paddingHorizontal: ACADEMY_CARD_HP,
      paddingTop: tokens.spacing.sm,
      paddingBottom: tokens.spacing['5xl'],
      flexGrow: 1,
    },
    noteWrap: {
      marginBottom: tokens.spacing.md,
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
      fontSize: 15,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
    },
    noteLessonTitle: {
      fontSize: 13,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
    },
    noteContent: {
      fontSize: 14,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 21,
    },
    noteDate: {
      marginTop: tokens.spacing.sm,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
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
      borderColor: tokens.colors.border.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyTitle: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
