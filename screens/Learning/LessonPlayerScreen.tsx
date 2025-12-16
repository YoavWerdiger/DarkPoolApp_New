import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useLesson, useSaveProgress, useGetSignedUrl } from '../../hooks/useLearning';
import { LessonWithProgress, BlockType } from '../../types/learning';
import { ArrowRight, ChevronLeft, ChevronRight, Play, Pause, ChevronDown, Edit3 } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

const { width: screenWidth } = Dimensions.get('window');

export const LessonPlayerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const { lessonId, initialBlockIndex = 0 } = route.params as { 
    lessonId: string; 
    initialBlockIndex?: number;
  };
  
  const [currentBlockIndex, setCurrentBlockIndex] = useState(initialBlockIndex);
  const [videoPosition, setVideoPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: lesson, isLoading, error } = useLesson(lessonId);
  const saveProgressMutation = useSaveProgress();
  const getSignedUrlMutation = useGetSignedUrl();

  const currentBlock = lesson?.blocks?.[currentBlockIndex];

  // Load signed URL for video blocks
  useEffect(() => {
    if (currentBlock?.type === 'video' && currentBlock.video_key) {
      loadSignedUrl(currentBlock.video_key);
    }
  }, [currentBlock]);

  const loadSignedUrl = useCallback(async (videoKey: string) => {
    setIsLoadingVideo(true);
    try {
      const response = await getSignedUrlMutation.mutateAsync({
        path: videoKey,
        expires_in: 3600 // 1 hour
      });
      setSignedUrl(response.signed_url);
    } catch (error) {
      Alert.alert(
        'שגיאה',
        'לא ניתן לטעון את הוידאו. בדוק את החיבור לאינטרנט.',
        [{ text: 'אישור' }]
      );
    } finally {
      setIsLoadingVideo(false);
    }
  }, [getSignedUrlMutation]);

  const handleVideoProgress = useCallback((position: number) => {
    setVideoPosition(position);
    setProgress(position);
    
    // Calculate progress percentage
    if (duration > 0) {
      const progressPercentage = Math.round((position / duration) * 100);
      setLessonProgress(Math.min(Math.max(progressPercentage, 0), 100));
    }
    
    // Save progress every 5 seconds
    if (Math.floor(position) % 5 === 0) {
      saveProgressMutation.mutate({
        lesson_id: lessonId,
        status: 'in_progress',
        last_position_seconds: Math.floor(position)
      });
    }
  }, [lessonId, saveProgressMutation, duration]);

  const handleVideoComplete = useCallback(() => {
    // Mark lesson as completed
    saveProgressMutation.mutate({
      lesson_id: lessonId,
      status: 'completed'
    });
  }, [lessonId, saveProgressMutation]);

  const goToNextBlock = useCallback(() => {
    if (lesson?.blocks && currentBlockIndex < lesson.blocks.length - 1) {
      setCurrentBlockIndex(currentBlockIndex + 1);
    }
  }, [lesson?.blocks, currentBlockIndex]);

  const goToPreviousBlock = useCallback(() => {
    if (currentBlockIndex > 0) {
      setCurrentBlockIndex(currentBlockIndex - 1);
    }
  }, [currentBlockIndex]);

  const renderVideoBlock = () => {
    if (!currentBlock?.video_key) {
      return (
        <View style={styles.blockErrorContainer}>
          <Text style={styles.blockErrorText}>וידאו לא זמין</Text>
        </View>
      );
    }

    if (isLoadingVideo) {
      return (
        <View style={styles.blockLoadingContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={styles.blockLoadingText}>טוען וידאו...</Text>
        </View>
      );
    }

    if (!signedUrl) {
      return (
        <View style={styles.blockErrorContainer}>
          <Text style={styles.blockErrorText}>לא ניתן לטעון את הוידאו</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <Video
          style={styles.video}
          source={{ uri: signedUrl }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              const currentPosition = status.positionMillis / 1000;
              const totalDuration = status.durationMillis ? status.durationMillis / 1000 : duration;
              
              if (totalDuration > 0 && totalDuration !== duration) {
                setDuration(totalDuration);
              }
              
              handleVideoProgress(currentPosition);
              if (status.didJustFinish) {
                handleVideoComplete();
              }
            }
          }}
          posterSource={currentBlock.video_poster_url ? { uri: currentBlock.video_poster_url } : undefined}
          usePoster={true}
        />
      </View>
    );
  };

  const renderTextBlock = () => {
    if (!currentBlock?.text_md) {
      return (
        <View style={styles.blockErrorContainer}>
          <Text style={styles.blockErrorText}>תוכן לא זמין</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.textContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.textContent}>
          {currentBlock.text_md}
        </Text>
      </ScrollView>
    );
  };

  const renderPdfBlock = () => {
    return (
      <View style={styles.pdfContainer}>
        <Text style={styles.pdfText}>תצוגת PDF</Text>
        <Text style={styles.pdfSubtext}>
          תכונה זו תהיה זמינה בקרוב
        </Text>
        {currentBlock?.pdf_url && (
          <TouchableOpacity style={styles.downloadButton}>
            <Text style={styles.downloadButtonText}>הורד PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderQuizBlock = () => {
    return (
      <View style={styles.quizContainer}>
        <Text style={styles.quizText}>חידון</Text>
        <Text style={styles.quizSubtext}>
          תכונה זו תהיה זמינה בקרוב
        </Text>
        <TouchableOpacity 
          style={styles.quizButton}
          onPress={() => navigation.navigate('QuizScreen' as never, { 
            blockId: currentBlock?.id 
          } as never)}
        >
          <Text style={styles.quizButtonText}>התחל חידון</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCurrentBlock = () => {
    if (!currentBlock) {
      return (
        <View style={styles.blockErrorContainer}>
          <Text style={styles.blockErrorText}>תוכן לא זמין</Text>
        </View>
      );
    }

    switch (currentBlock.type) {
      case 'video':
        return renderVideoBlock();
      case 'text':
        return renderTextBlock();
      case 'pdf':
        return renderPdfBlock();
      case 'quiz':
        return renderQuizBlock();
      default:
        return (
          <View style={styles.blockErrorContainer}>
            <Text style={styles.blockErrorText}>סוג תוכן לא נתמך</Text>
          </View>
        );
    }
  };

  if (isLoading) {
    return (
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        style={styles.gradientContainer}
      >
        <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={styles.loadingText}>טוען שיעור...</Text>
          </View>
        </RNSafeAreaView>
      </LinearGradient>
    );
  }

  if (error || !lesson) {
    return (
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        style={styles.gradientContainer}
      >
        <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>שגיאה בטעינת השיעור</Text>
            <Text style={styles.errorMessage}>
              {error?.message || 'השיעור לא נמצא'}
            </Text>
          </View>
        </RNSafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={styles.gradientContainer}
    >
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        {/* Header */}
        <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.md }}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
          {/* Lesson Info Card */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginTop: DesignTokens.spacing.md, marginBottom: DesignTokens.spacing.lg }}>
            <UICard variant="blur" padding="lg">
              <Text style={styles.lessonInfoTitle}>{lesson.title}</Text>
              <Text style={styles.lessonInfoSubtitle}>שיעור {currentBlockIndex + 1} בקורס הכשרה של דוד אריאל</Text>
              
              {/* Progress Info */}
              {currentBlock?.type === 'video' && duration > 0 && (
                <View style={styles.lessonProgressInfo}>
                  <View style={styles.progressTimeRow}>
                    <Text style={styles.progressTimeText}>
                      {Math.floor(progress / 60)}:{(Math.floor(progress % 60)).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
                    </Text>
                    <Text style={styles.progressPercentageText}>{lessonProgress}%</Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(Math.max(lessonProgress, 0), 100)}%` }]} />
                  </View>
                </View>
              )}
            </UICard>
          </View>

          {/* Content */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.lg }}>
            <UICard variant="blur" padding="none">
              {renderCurrentBlock()}
            </UICard>
          </View>

          {/* Video Controls */}
          {currentBlock?.type === 'video' && (
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.lg }}>
              <UICard variant="blur" padding="lg">
                <View style={styles.videoControls}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <Pause size={24} color={DesignTokens.colors.background.primary} strokeWidth={2} />
                    ) : (
                      <Play size={24} color={DesignTokens.colors.background.primary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
              </UICard>
            </View>
          )}

          {/* Personal Notes Card */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.lg }}>
            <UICard variant="blur" padding="md">
              <TouchableOpacity
                style={styles.notesHeader}
                onPress={() => setNotesExpanded(!notesExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.notesTitle}>הערות אישיות על השיעור</Text>
                <View style={styles.notesHeaderIcons}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      // TODO: Open notes editor
                    }}
                    style={styles.notesEditButton}
                  >
                    <Edit3 size={18} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  </TouchableOpacity>
                  <ChevronDown 
                    size={20} 
                    color={DesignTokens.colors.text.tertiary} 
                    strokeWidth={2}
                    style={{ transform: [{ rotate: notesExpanded ? '180deg' : '0deg' }] }}
                  />
                </View>
              </TouchableOpacity>
              
              {notesExpanded && (
                <View style={styles.notesContent}>
                  <Text style={styles.notesPlaceholder}>לחץ לכתיבת הערות...</Text>
                </View>
              )}
            </UICard>
          </View>

          {/* Navigation */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingBottom: DesignTokens.spacing.lg }}>
            <UICard variant="blur" padding="md">
              <View style={styles.navigation}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    (!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1) && styles.navButtonDisabled
                  ]}
                  onPress={goToNextBlock}
                  disabled={!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1}
                >
                  <ChevronRight size={20} color={(!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1) ? DesignTokens.colors.text.tertiary : DesignTokens.colors.primary.main} strokeWidth={2} />
                  <Text style={[
                    styles.navButtonText,
                    (!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1) && styles.navButtonTextDisabled
                  ]}>
                    הבא
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.navButton,
                    currentBlockIndex === 0 && styles.navButtonDisabled
                  ]}
                  onPress={goToPreviousBlock}
                  disabled={currentBlockIndex === 0}
                >
                  <Text style={[
                    styles.navButtonText,
                    currentBlockIndex === 0 && styles.navButtonTextDisabled
                  ]}>
                    הקודם
                  </Text>
                  <ChevronLeft size={20} color={currentBlockIndex === 0 ? DesignTokens.colors.text.tertiary : DesignTokens.colors.primary.main} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </UICard>
          </View>
          </ScrollView>
        </View>
      </RNSafeAreaView>
    </LinearGradient>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  safeAreaContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: tokens.spacing['5xl'],
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: tokens.spacing.lg,
  },
  errorTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: (screenWidth * 9) / 16, // 16:9 aspect ratio
    backgroundColor: 'transparent',
  },
  textContainer: {
    padding: tokens.spacing.lg,
    minHeight: 200,
  },
  textContent: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.primary,
    lineHeight: 24,
    textAlign: 'right',
  },
  pdfContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    minHeight: 200,
  },
  blockErrorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    minHeight: 200,
  },
  blockErrorText: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  blockLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  blockLoadingText: {
    marginTop: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.secondary,
  },
  pdfText: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  pdfSubtext: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  downloadButton: {
    backgroundColor: tokens.colors.primary.main,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  downloadButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: '#000000',
  },
  quizContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    minHeight: 200,
  },
  quizText: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.xs,
  },
  quizSubtext: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  quizButton: {
    backgroundColor: tokens.colors.primary.main,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  quizButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: '#000000',
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: tokens.colors.primary.main,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 209, 87, 0.08)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    gap: tokens.spacing.xs,
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.text.primary,
  },
  navButtonTextDisabled: {
    color: tokens.colors.text.tertiary,
  },
  lessonInfoTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: tokens.spacing.xs,
  },
  lessonInfoSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    marginBottom: tokens.spacing.md,
  },
  lessonProgressInfo: {
    marginTop: tokens.spacing.md,
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  progressTimeText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
  progressPercentageText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    fontWeight: tokens.typography.fontWeight.semibold as any,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 3,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesTitle: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold as any,
    color: tokens.colors.danger.main,
  },
  notesHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  notesEditButton: {
    padding: tokens.spacing.xs,
  },
  notesContent: {
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  notesPlaceholder: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.tertiary,
    textAlign: 'right',
  },
});

