import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, TextInput, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { courseService } from '../../services/courseService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { ScreenChrome } from '../../components/ui';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { AcademySubScreenBar } from '../../components/learning';
import { ACADEMY_CARD_HP, academyCardFrameStyle } from '../../components/learning/academyCardLayout';

export const CoursePreviewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  
  // קבלת קישורי יוטיוב מה-route params אם קיימים
  const routeParams = route.params as { youtubeLinks?: string[] } | undefined;
  const [youtubeLinks, setYoutubeLinks] = useState<string[]>(routeParams?.youtubeLinks || []);
  const [isCreating, setIsCreating] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [linkInputValue, setLinkInputValue] = useState('');

  // קבלת תצוגה מקדימה של הקורס
  const preview = useMemo(() => {
    return courseService.previewDavidTrainingCourse(youtubeLinks.length > 0 ? youtubeLinks : undefined);
  }, [youtubeLinks]);

  const handleCreateCourse = async () => {
    setIsCreating(true);
    try {
      const result = await courseService.createDavidTrainingCourse(
        youtubeLinks.length > 0 ? youtubeLinks : undefined
      );
      
      if (result) {
        legacyAlert(
          'הצלחה!',
          'הקורס נוצר בהצלחה במסד הנתונים',
          [
            {
              text: 'אישור',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        legacyAlert('שגיאה', 'לא ניתן ליצור את הקורס כרגע');
      }
    } catch (error) {
      legacyAlert('שגיאה', 'אירעה שגיאה ביצירת הקורס');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenYoutubeLink = (url: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => {
        legacyAlert('שגיאה', 'לא ניתן לפתוח את הקישור');
      });
    }
  };

  const handleEditLink = (index: number) => {
    setLinkInputValue(youtubeLinks[index] || '');
    setEditingLinkIndex(index);
  };

  const handleSaveLink = () => {
    if (editingLinkIndex !== null) {
      const newLinks = [...youtubeLinks];
      // נוודא שיש מספיק מקום במערך
      while (newLinks.length <= editingLinkIndex) {
        newLinks.push('');
      }
      newLinks[editingLinkIndex] = linkInputValue;
      setYoutubeLinks(newLinks);
      setEditingLinkIndex(null);
      setLinkInputValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingLinkIndex(null);
    setLinkInputValue('');
  };

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
          <AcademySubScreenBar
            onBackPress={() => navigation.goBack()}
            title="תצוגה מקדימה"
          />

          {/* Course Info */}
          <UICard
            variant="blur"
            padding="lg"
            showGlassBorder={false}
            style={[styles.cardSpacing, academyCardFrameStyle('free')]}
          >
          <Text style={styles.courseTitle}>{preview.course.title}</Text>
          <Text style={styles.courseSubtitle}>{preview.course.subtitle}</Text>
          <Text style={styles.courseDescription}>{preview.course.description}</Text>
          
          <View style={styles.courseMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>מדריך:</Text>
              <Text style={styles.metaValue}>{preview.course.instructor_name}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>שיעורים:</Text>
              <Text style={styles.metaValue}>{preview.summary.totalLessons}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>משך זמן:</Text>
              <Text style={styles.metaValue}>{preview.summary.totalDuration} שעות</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>רמה:</Text>
              <Text style={styles.metaValue}>{preview.course.level}</Text>
            </View>
          </View>

          {preview.summary.lessonsWithoutLinks > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ {preview.summary.lessonsWithoutLinks} שיעורים ללא קישור יוטיוב
              </Text>
            </View>
          )}
          </UICard>

          {/* Lessons List */}
          <View style={styles.lessonsSection}>
            <Text style={styles.sectionTitle}>רשימת שיעורים ({preview.lessons.length})</Text>
            
            {preview.lessons.map((lesson, index) => (
              <UICard
                key={lesson.id}
                variant="blur"
                padding="md"
                showGlassBorder={false}
                style={[styles.lessonCard, academyCardFrameStyle('neutral')]}
              >
              <View style={styles.lessonHeader}>
                <Text style={styles.lessonNumber}>{index + 1}</Text>
                <View style={styles.lessonInfo}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonDuration}>
                    ⏱️ {lesson.duration} ({lesson.durationMinutes} דקות)
                  </Text>
                </View>
              </View>
              
              {lesson.youtubeUrl ? (
                <View style={styles.linkActions}>
                  <TouchableOpacity
                    style={[styles.youtubeButton, styles.openButton]}
                    onPress={() => handleOpenYoutubeLink(lesson.youtubeUrl!)}
                  >
                    <Text style={styles.youtubeButtonText}>🔗 פתח קישור יוטיוב</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.youtubeButton, styles.editButton]}
                    onPress={() => handleEditLink(index)}
                  >
                    <Text style={styles.youtubeButtonText}>✏️ ערוך</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addLinkButton}
                  onPress={() => handleEditLink(index)}
                >
                  <Text style={styles.addLinkText}>➕ הוסף קישור יוטיוב</Text>
                </TouchableOpacity>
              )}
              </UICard>
            ))}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, isCreating && styles.createButtonDisabled]}
            onPress={handleCreateCourse}
            disabled={isCreating}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>
              {isCreating ? 'יוצר קורס...' : '✅ צור קורס במסד הנתונים'}
            </Text>
          </TouchableOpacity>

          <UICard
            variant="blur"
            padding="md"
            showGlassBorder={false}
            style={[styles.footerCard, academyCardFrameStyle('neutral')]}
          >
            <Text style={styles.footerText}>
              לאחר לחיצה על "צור קורס", הקורס יווצר במסד הנתונים עם כל השיעורים.
              {youtubeLinks.length === 0 && ' ניתן להוסיף קישורי יוטיוב מאוחר יותר.'}
            </Text>
          </UICard>
          </ScrollView>
        </View>
      </RNSafeAreaView>

      {/* Modal לעריכת קישור */}
      <Modal
        visible={editingLinkIndex !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingLinkIndex !== null && preview.lessons[editingLinkIndex]
                ? `עריכת קישור: ${preview.lessons[editingLinkIndex].title}`
                : 'הוספת קישור יוטיוב'}
            </Text>
            <TextInput
              style={styles.linkInput}
              value={linkInputValue}
              onChangeText={setLinkInputValue}
              placeholder="הדבק קישור יוטיוב כאן..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.modalButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveLink}
              >
                <Text style={styles.modalButtonText}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    safeAreaContainer: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: tokens.colors.background.primary,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: ACADEMY_CARD_HP,
      paddingBottom: tokens.spacing['4xl'],
    },
    cardSpacing: {
      marginBottom: tokens.spacing.lg,
    },
    lessonCard: {
      marginBottom: tokens.spacing.md,
    },
    footerCard: {
      marginTop: tokens.spacing.lg,
    },
    courseTitle: {
      fontSize: tokens.typography.fontSize.xl,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.sm,
      textAlign: 'right',
    },
    courseSubtitle: {
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.secondary,
      marginBottom: tokens.spacing.sm,
      textAlign: 'right',
    },
    courseDescription: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.tertiary,
      marginBottom: tokens.spacing.md,
      textAlign: 'right',
      lineHeight: 20,
    },
    courseMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.spacing.md,
      marginTop: tokens.spacing.md,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.spacing.xs,
    },
    metaLabel: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
    },
    metaValue: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.semibold as any,
      color: tokens.colors.text.primary,
    },
    warningBox: {
      backgroundColor: tokens.colors.danger.main + '20',
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      marginTop: tokens.spacing.md,
    },
    warningText: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.danger.main,
      textAlign: 'right',
    },
    lessonsSection: {
      marginTop: tokens.spacing.lg,
    },
    sectionTitle: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.md,
      textAlign: 'right',
    },
    lessonHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: tokens.spacing.sm,
    },
    lessonNumber: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.primary.main,
      marginLeft: tokens.spacing.md,
      minWidth: 30,
      textAlign: 'right',
    },
    lessonInfo: {
      flex: 1,
    },
    lessonTitle: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.medium as any,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.xs,
      textAlign: 'right',
    },
    lessonDuration: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },
    linkActions: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    youtubeButton: {
      flex: 1,
      backgroundColor: tokens.colors.primary.main,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.sm,
    },
    openButton: {
      backgroundColor: tokens.colors.primary.main,
    },
    editButton: {
      backgroundColor: tokens.colors.background.tertiary || tokens.colors.background.secondary,
    },
    youtubeButtonText: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    addLinkButton: {
      backgroundColor: tokens.colors.background.tertiary || tokens.colors.background.secondary,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
      borderWidth: tokens.layout?.borderWidth?.thin || 1,
      borderColor: tokens.colors.border.primary,
      borderStyle: 'dashed',
    },
    addLinkText: {
      fontSize: tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    noLinkBox: {
      backgroundColor: tokens.colors.background.primary,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
      borderWidth: tokens.layout?.borderWidth?.thin || 1,
      borderColor: tokens.colors.border.primary,
    },
    noLinkText: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    createButton: {
      backgroundColor: tokens.colors.primary.main,
      borderRadius: tokens.borderRadius.lg,
      padding: tokens.spacing.lg,
      marginTop: tokens.spacing.xl,
      alignItems: 'center',
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold as any,
      color: tokens.colors.text.inverse,
    },
    footerText: {
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: tokens.spacing.lg,
    },
    modalContent: {
      backgroundColor: tokens.colors.background.secondary,
      borderRadius: tokens.borderRadius.lg,
      padding: tokens.spacing.lg,
      width: '100%',
      maxWidth: 500,
      borderWidth: tokens.layout?.borderWidth?.thin || 1,
      borderColor: tokens.colors.border.primary,
    },
    modalTitle: {
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.bold,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.md,
      textAlign: 'right',
    },
    linkInput: {
      backgroundColor: tokens.colors.background.primary,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      fontSize: tokens.typography.fontSize.base,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.lg,
      borderWidth: tokens.layout?.borderWidth?.thin || 1,
      borderColor: tokens.colors.border.primary,
      textAlign: 'right',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: tokens.spacing.md,
    },
    modalButton: {
      flex: 1,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    saveButton: {
      backgroundColor: tokens.colors.primary.main,
    },
    modalButtonText: {
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold as any,
      color: tokens.colors.text.primary,
    },
  });

