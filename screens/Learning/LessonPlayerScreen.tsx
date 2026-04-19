import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLesson, useSaveProgress, useGetSignedUrl } from '../../hooks/useLearning';
import { LessonWithProgress, BlockType } from '../../types/learning';
import { ChevronLeft, ChevronRight, Play, Pause, ChevronDown, Edit3 } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

const { width: screenWidth } = Dimensions.get('window');

export const LessonPlayerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
  const [timelineWidth, setTimelineWidth] = useState(0);
  const videoRef = useRef<Video>(null);

  const { data: lesson, isLoading, error } = useLesson(lessonId);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback((positionSeconds: number) => {
    const ms = Math.max(0, positionSeconds) * 1000;
    (videoRef.current as any)?.setPositionAsync(ms).then(() => {
      setProgress(positionSeconds);
      if (duration > 0) {
        setLessonProgress(Math.round((positionSeconds / duration) * 100));
      }
    }).catch(() => {});
  }, [duration]);

  const handleTimelinePress = useCallback((evt: { nativeEvent: { locationX: number } }) => {
    if (timelineWidth <= 0 || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / timelineWidth));
    handleSeek(ratio * duration);
  }, [timelineWidth, duration, handleSeek]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) (videoRef.current as any).playAsync?.();
    else (videoRef.current as any).pauseAsync?.();
  }, [isPlaying]);
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
      legacyAlert(
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
          ref={videoRef}
          style={styles.video}
          source={{ uri: signedUrl }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          useNativeControls={false}
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
        {/* נגן מותאם: טיימליין + play/pause */}
        <View style={styles.playerControls}>
          <TouchableOpacity style={styles.playerPlayButton} onPress={togglePlayPause} activeOpacity={0.8}>
            {isPlaying ? (
              <Ionicons name="pause" size={24} color={DesignTokens.colors.background.primary} />
            ) : (
              <Ionicons name="play" size={24} color={DesignTokens.colors.background.primary} />
            )}
          </TouchableOpacity>
          <Text style={styles.playerTimeText}>{formatTime(progress)}</Text>
          <Pressable
            style={styles.timelineTrack}
            onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
            onPress={handleTimelinePress}
          >
            <View style={[styles.timelineFill, { width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }]} />
          </Pressable>
          <Text style={styles.playerTimeText}>{formatTime(duration)}</Text>
        </View>
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
          onPress={() => (navigation as { navigate: (n: string, p?: object) => void }).navigate('QuizScreen', {
            blockId: currentBlock?.id,
          })}
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
        colors={['rgba(10,10,10,0.98)', 'rgba(10,10,10,0.95)', 'rgba(10,10,10,0.92)', 'rgba(10,10,10,0.92)', 'rgba(10,10,10,0.95)', 'rgba(10,10,10,0.98)']}
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
        colors={['rgba(10,10,10,0.98)', 'rgba(10,10,10,0.95)', 'rgba(10,10,10,0.92)', 'rgba(10,10,10,0.92)', 'rgba(10,10,10,0.95)', 'rgba(10,10,10,0.98)']}
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
      colors={['rgba(10,10,10,0.98)', 'rgba(10,10,10,0.95)', 'rgba(10,10,10,0.92)', 'rgba(10,10,10,0.92)', 'rgba(10,10,10,0.95)', 'rgba(10,10,10,0.98)']}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={styles.gradientContainer}
    >
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        {/* Header – באותו סגנון כמו צ'אט */}
        <View style={styles.headerWrapper}>
          <UICard
            variant="blur"
            padding="md"
            style={[
              styles.headerCard,
              { paddingTop: insets.top + 8 },
            ]}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={22} color={DesignTokens.colors.text.secondary} />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <View style={styles.headerInfo}>
                  <View style={styles.headerTitleRow}>
                    <View style={styles.headerIconPlaceholder}>
                      <Ionicons name="book-outline" size={18} color={DesignTokens.colors.text.secondary} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
                      <Text style={styles.headerSubtitle}>
                        שיעור {currentBlockIndex + 1} מתוך {lesson.blocks?.length ?? 0}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.headerSpacer} />
            </View>
          </UICard>
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
              <View style={styles.lessonInfoStack}>
                <Text style={styles.lessonInfoTitle}>{lesson.title}</Text>
                <Text style={styles.lessonInfoSubtitle}>שיעור {currentBlockIndex + 1} בקורס הכשרה של דוד אריאל</Text>

                {/* Progress Info */}
                {currentBlock?.type === 'video' && duration > 0 ? (
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
                ) : null}
              </View>
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
  headerWrapper: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: tokens.spacing.sm,
  },
  headerCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: tokens.borderRadius['2xl'],
    borderBottomRightRadius: tokens.borderRadius['2xl'],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backButton: {
    padding: 8,
    marginLeft: 5,
    marginRight: -3,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    marginBottom: 2,
    marginRight: 5,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerSubtitle: {
    fontSize: 12,
    marginRight: 5,
    color: tokens.colors.text.secondary,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerSpacer: {
    width: 36,
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
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  playerPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerTimeText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
    minWidth: 44,
    textAlign: 'center',
  },
  timelineTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  timelineFill: {
    height: '100%',
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 2,
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
    color: tokens.colors.text.inverse,
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
    color: tokens.colors.text.inverse,
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
  lessonInfoStack: {
    gap: tokens.spacing.sm,
    width: '100%',
  },
  lessonInfoTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold as any,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.xl * tokens.typography.lineHeight.normal),
    writingDirection: 'rtl',
  },
  lessonInfoSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: Math.round(tokens.typography.fontSize.sm * tokens.typography.lineHeight.normal),
    writingDirection: 'rtl',
  },
  lessonProgressInfo: {
    marginTop: 0,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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

