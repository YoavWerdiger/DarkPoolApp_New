import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, TextInput, Modal } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { courseService } from '../../services/courseService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import {
  ACADEMY_TYPE,
  academyCardSubtitleStyle,
  academyCardTitleStyle,
  academySectionTitleStyle,
} from '../../components/learning/academyLayout';
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
          i18n.t('auto.screens__Learning__CoursePreviewScreen.s1'),
          i18n.t('auto.screens__Learning__CoursePreviewScreen.s2'),
          [
            {
              text: i18n.t('auto.screens__Learning__CoursePreviewScreen.s3'),
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        legacyAlert(i18n.t('auto.screens__Learning__CoursePreviewScreen.s4'), i18n.t('auto.screens__Learning__CoursePreviewScreen.s5'));
      }
    } catch (error) {
      legacyAlert(i18n.t('auto.screens__Learning__CoursePreviewScreen.s4'), i18n.t('auto.screens__Learning__CoursePreviewScreen.s6'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenYoutubeLink = (url: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => {
        legacyAlert(i18n.t('auto.screens__Learning__CoursePreviewScreen.s4'), i18n.t('auto.screens__Learning__CoursePreviewScreen.s7'));
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
    <ScreenChrome>
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
          <AcademySubScreenBar
            onBackPress={() => navigation.goBack()}
            title={i18n.t('auto.screens__Learning__CoursePreviewScreen.s8')}
          />

          {/* Course Info */}
          <UICard
            variant="soft"
            padding="lg"
            style={[styles.cardSpacing, academyCardFrameStyle('neutral')]}
          >
          <Text style={styles.courseTitle}>{preview.course.title}</Text>
          <Text style={styles.courseSubtitle}>{preview.course.subtitle}</Text>
          <Text style={styles.courseDescription}>{preview.course.description}</Text>
          
          <View style={styles.courseMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s9')}</Text>
              <Text style={styles.metaValue}>{preview.course.instructor_name}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s10')}</Text>
              <Text style={styles.metaValue}>{preview.summary.totalLessons}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s11')}</Text>
              <Text style={styles.metaValue}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s12', { v0: preview.summary.totalDuration })}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s13')}</Text>
              <Text style={styles.metaValue}>{preview.course.level}</Text>
            </View>
          </View>

          {preview.summary.lessonsWithoutLinks > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s14', { v0: preview.summary.lessonsWithoutLinks })}</Text>
            </View>
          )}
          </UICard>

          {/* Lessons List */}
          <View style={styles.lessonsSection}>
            <Text style={styles.sectionTitle}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s15', { v0: preview.lessons.length })}</Text>
            
            {preview.lessons.map((lesson, index) => (
              <UICard
                key={lesson.id}
                variant="soft"
                padding="md"
                style={[styles.lessonCard, academyCardFrameStyle('neutral')]}
              >
              <View style={styles.lessonHeader}>
                <Text style={styles.lessonNumber}>{index + 1}</Text>
                <View style={styles.lessonInfo}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonDuration}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s16', { v0: lesson.duration, v1: lesson.durationMinutes })}</Text>
                </View>
              </View>
              
              {lesson.youtubeUrl ? (
                <View style={styles.linkActions}>
                  <TouchableOpacity
                    style={[styles.youtubeButton, styles.openButton]}
                    onPress={() => handleOpenYoutubeLink(lesson.youtubeUrl!)}
                  >
                    <Text style={styles.youtubeButtonText}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s17')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.youtubeButton, styles.editButton]}
                    onPress={() => handleEditLink(index)}
                  >
                    <Text style={styles.youtubeButtonText}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s18')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addLinkButton}
                  onPress={() => handleEditLink(index)}
                >
                  <Text style={styles.addLinkText}>{i18n.t('auto.screens__Learning__CoursePreviewScreen.s19')}</Text>
                </TouchableOpacity>
              )}
              </UICard>
            ))}
          </View>

          {/* Create Button */}
          <UIButton
            title={isCreating ? i18n.t('auto.screens__Learning__CoursePreviewScreen.s20') : i18n.t('auto.screens__Learning__CoursePreviewScreen.s21')}
            variant="primary"
            fullWidth
            loading={isCreating}
            disabled={isCreating}
            onPress={handleCreateCourse}
          />

          <UICard
            variant="soft"
            padding="md"
            style={[styles.footerCard, academyCardFrameStyle('neutral')]}
          >
            <Text style={styles.footerText}>
              {i18n.t('auto.screens__Learning__CoursePreviewScreen.s22')}
              {youtubeLinks.length === 0 && i18n.t('auto.screens__Learning__CoursePreviewScreen.s23')}
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
                ? i18n.t('auto.screens__Learning__CoursePreviewScreen.s24', { v0: preview.lessons[editingLinkIndex].title })
                : i18n.t('auto.screens__Learning__CoursePreviewScreen.s25')}
            </Text>
            <TextInput
              style={styles.linkInput}
              value={linkInputValue}
              onChangeText={setLinkInputValue}
              placeholder={i18n.t('auto.screens__Learning__CoursePreviewScreen.s26')}
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />
            <View style={styles.modalButtons}>
              <View style={{ flex: 1 }}>
                <UIButton title={i18n.t('auto.screens__Learning__CoursePreviewScreen.s27')} variant="secondary" fullWidth onPress={handleCancelEdit} />
              </View>
              <View style={{ flex: 1 }}>
                <UIButton title={i18n.t('auto.screens__Learning__CoursePreviewScreen.s28')} variant="primary" fullWidth onPress={handleSaveLink} />
              </View>
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
      marginBottom: APP_LAYOUT.cardStackGap,
      borderRadius: UI_CARD_RADIUS,
    },
    footerCard: {
      marginTop: tokens.spacing.lg,
    },
    courseTitle: {
      ...academyCardTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
    },
    courseSubtitle: {
      ...academyCardSubtitleStyle,
      marginBottom: APP_LAYOUT.cardTitleToBodyGap,
    },
    courseDescription: {
      ...ACADEMY_TYPE.cardBody,
      color: tokens.colors.text.tertiary,
      marginBottom: APP_LAYOUT.cardTitleToBodyGap,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
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
      ...ACADEMY_TYPE.caption,
      color: tokens.colors.text.secondary,
    },
    metaValue: {
      ...ACADEMY_TYPE.caption,
      color: tokens.colors.text.primary,
    },
    warningBox: {
      backgroundColor: tokens.colors.danger.main + '20',
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.md,
      marginTop: tokens.spacing.md,
    },
    warningText: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.danger.main,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
    },
    lessonsSection: {
      marginTop: tokens.spacing.lg,
    },
    sectionTitle: {
      ...academySectionTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.sectionHeaderToContent,
    },
    lessonHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: tokens.spacing.sm,
    },
    lessonNumber: {
      ...ACADEMY_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      marginLeft: 12,
      minWidth: 30,
      textAlign: 'right',
    },
    lessonInfo: {
      flex: 1,
    },
    lessonTitle: {
      ...academyCardTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
    },
    lessonDuration: {
      ...academyCardSubtitleStyle,
      marginTop: 0,
    },
    linkActions: {
      flexDirection: 'row',
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    youtubeButton: {
      flex: 1,
      backgroundColor: tokens.colors.background.navChrome,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.sm,
    },
    openButton: {
      backgroundColor: tokens.colors.background.navChrome,
    },
    editButton: {
      backgroundColor: tokens.colors.background.navChrome,
    },
    youtubeButtonText: {
      ...ACADEMY_TYPE.caption,
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    addLinkButton: {
      backgroundColor: tokens.colors.background.navChrome,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
      borderWidth: 0,
    },
    addLinkText: {
      ...ACADEMY_TYPE.caption,
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
      ...ACADEMY_TYPE.caption,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    footerText: {
      ...ACADEMY_TYPE.cardBody,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: tokens.spacing.lg,
    },
    modalContent: {
      backgroundColor: tokens.colors.background.cardSolid,
      borderRadius: UI_CARD_RADIUS,
      padding: APP_LAYOUT.cardPadding,
      width: '100%',
      maxWidth: 500,
      borderWidth: 0,
    },
    modalTitle: {
      ...academyCardTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToBodyGap,
    },
    linkInput: {
      backgroundColor: tokens.colors.background.input,
      borderRadius: tokens.borderRadius.md,
      padding: APP_LAYOUT.cardPadding,
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToBodyGap,
      borderWidth: 0,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
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
      backgroundColor: tokens.colors.background.navChrome,
      borderWidth: 0,
    },
    saveButton: {
      backgroundColor: tokens.colors.primary.lightCta,
      borderRadius: tokens.borderRadius.full,
    },
    modalButtonText: {
      ...ACADEMY_TYPE.body,
      fontWeight: ACADEMY_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
  });

