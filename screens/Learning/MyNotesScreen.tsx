import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { learningProgressService } from '../../services/learningProgressService';
import { useAuth } from '../../context/AuthContext';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { FileText, Copy } from 'lucide-react-native';
import { AcademySubScreenBar } from '../../components/learning';
import UICard from '../../components/ui/UICard';
import * as Clipboard from 'expo-clipboard';
import { HapticFeedback } from '../../utils/hapticFeedback';

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
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
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
    } catch (error) {
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotes();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadNotes]);

  const handleNotePress = useCallback((note: NoteWithDetails) => {
    void HapticFeedback.impactLight();
    (navigation as { navigate: (n: string, p: object) => void }).navigate('LearningScreen', {
      courseId: note.course_id,
      lessonId: note.lesson_id,
    });
  }, [navigation]);

  const handleCopyNote = useCallback(async (note: NoteWithDetails, e: any) => {
    e.stopPropagation();
    try {
      await Clipboard.setStringAsync(note.notes_content);
      void HapticFeedback.selection();
      legacyAlert('הועתק', 'ההערה הועתקה ללוח');
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן להעתיק את ההערה');
    }
  }, []);

  const renderNote = useCallback(({ item }: { item: NoteWithDetails }) => {
    const notePreview = item.notes_content.length > 150
      ? item.notes_content.substring(0, 150) + '...'
      : item.notes_content;

    return (
      <TouchableOpacity
        onPress={() => handleNotePress(item)}
        activeOpacity={0.7}
        style={{ marginBottom: DesignTokens.spacing.md }}
      >
        <UICard variant="blur" padding="md">
          <View style={styles.noteContentContainer}>
            <View style={styles.noteHeader}>
              <View style={styles.noteIconContainer}>
                <FileText size={18} color={DesignTokens.colors.primary.main} />
              </View>
              <View style={styles.noteInfo}>
                <Text style={styles.noteCourseTitle} numberOfLines={1}>
                  {item.course_title || 'קורס ללא שם'}
                </Text>
                <Text style={styles.noteLessonTitle} numberOfLines={1}>
                  {item.lesson_title || 'שיעור ללא שם'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={(e) => handleCopyNote(item, e)}
                activeOpacity={0.7}
              >
                <Copy size={16} color={DesignTokens.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.noteContent} numberOfLines={3}>
              {notePreview}
            </Text>
            {item.updated_at && (
              <Text style={styles.noteDate}>
                עודכן: {new Date(item.updated_at).toLocaleDateString('he-IL')}
              </Text>
            )}
          </View>
        </UICard>
      </TouchableOpacity>
    );
  }, [styles, DesignTokens, handleNotePress, handleCopyNote]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <FileText size={64} color={DesignTokens.colors.text.tertiary} />
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={styles.loadingText}>טוען הערות...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.safeAreaContent}>
          <AcademySubScreenBar
            onBackPress={() => navigation.goBack()}
            title="ההערות שלי"
            subtitle={`${notes.length} הערות`}
          />
        </View>
      </SafeAreaView>

      {/* Notes List */}
      <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
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
    </View>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    // edges handled by component
  },
  safeAreaContent: {},
  safeAreaContainer: {
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
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing['5xl'],
  },
  noteContentContainer: {
    flex: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  noteIconContainer: {
    width: 32,
    height: 32,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.primary.main + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: tokens.spacing.sm,
  },
  noteInfo: {
    flex: 1,
  },
  copyButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.background.primary,
    marginRight: tokens.spacing.xs,
  },
  noteCourseTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 2,
  },
  noteLessonTitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  noteContent: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: tokens.typography.lineHeight.relaxed * tokens.typography.fontSize.sm,
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  noteDate: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
    marginTop: tokens.spacing.xs / 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing['5xl'],
    paddingHorizontal: tokens.spacing.xl,
  },
  emptyIconContainer: {
    marginBottom: tokens.spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    lineHeight: tokens.typography.lineHeight.relaxed * tokens.typography.fontSize.base,
  },
});

