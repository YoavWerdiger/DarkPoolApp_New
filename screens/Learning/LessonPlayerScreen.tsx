import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLesson, useSaveProgress, useGetSignedUrl } from '../../hooks/useLearning';
import { LessonWithProgress, BlockType } from '../../types/learning';
import { ChevronLeft, ChevronRight, Play, Pause, ChevronDown, Edit3, ArrowRight } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { useAuth } from '../../context/AuthContext';
import { learningProgressService } from '../../services/learningProgressService';

const { width: screenWidth } = Dimensions.get('window');

/** רקע אטום (לא rgba חצי־שקוף) — אחרת רואים את הגרדיאנט הירוק של מסכי האקדמיה מתחת */
const LESSON_BG_GRADIENT = ['#080808', '#0A0A0A', '#0B0B0B', '#0B0B0B', '#0A0A0A', '#080808'] as const;

const SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;
type PlaybackSpeed = typeof SPEEDS[number];

export const LessonPlayerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const { user } = useAuth();
  const { lessonId, initialBlockIndex = 0, courseId } = route.params as {
    lessonId: string;
    initialBlockIndex?: number;
    courseId?: string;
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
  const [notesSaving, setNotesSaving] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const videoRef = useRef<Video>(null);

  const { data: lesson, isLoading, error } = useLesson(lessonId);

  // Load existing notes + resume position on mount
  useEffect(() => {
    if (!user?.id || !lessonId) return;
    const cid = courseId || (lesson as any)?.course_id;
    if (cid) {
      learningProgressService.getUserNotes(user.id, cid, lessonId)
        .then(n => { if (n?.notes_content) setNotes(n.notes_content); })
        .catch(() => {});
    }
    // Load last saved position for resume
    learningProgressService.getUserProgress(user.id, cid || '', lessonId)
      .then((p: any) => {
        if (p?.last_position_seconds && p.last_position_seconds > 5) {
          setResumePosition(p.last_position_seconds);
        }
      })
      .catch(() => {});
  }, [user?.id, lessonId, courseId, lesson]);

  // Seek to resume position after video loads
  useEffect(() => {
    if (resumePosition !== null && videoRef.current) {
      videoRef.current.setPositionAsync(resumePosition * 1000).catch(() => {});
      setProgress(resumePosition);
      setResumePosition(null);
    }
  }, [resumePosition, signedUrl]);

  const saveNotes = useCallback(async () => {
    if (!user?.id || !lessonId) return;
    const cid = courseId || (lesson as any)?.course_id;
    if (!cid) return;
    setNotesSaving(true);
    try {
      await learningProgressService.saveUserNotes({
        user_id: user.id,
        course_id: cid,
        lesson_id: lessonId,
        notes_content: notes,
      });
    } catch {
      // non-critical
    } finally {
      setNotesSaving(false);
    }
  }, [user?.id, lessonId, courseId, lesson, notes]);

  const toggleFullscreen = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isFullscreen) {
        await (videoRef.current as any).dismissFullscreenPlayer?.();
      } else {
        await (videoRef.current as any).presentFullscreenPlayer?.();
      }
      setIsFullscreen(f => !f);
    } catch { /* noop */ }
  }, [isFullscreen]);

  const changeSpeed = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
    setShowSpeedPicker(false);
    videoRef.current?.setRateAsync(speed, true).catch(() => {});
  }, []);

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
        {/* נגן מותאם: play/pause + timeline + speed + fullscreen */}
        <View style={styles.playerControls}>
          <TouchableOpacity style={styles.playerPlayButton} onPress={togglePlayPause} activeOpacity={0.8}>
            {isPlaying ? (
              <Ionicons name="pause" size={22} color={DesignTokens.colors.background.primary} />
            ) : (
              <Ionicons name="play" size={22} color={DesignTokens.colors.background.primary} />
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
          {/* Speed picker */}
          <TouchableOpacity
            style={styles.speedBtn}
            onPress={() => setShowSpeedPicker(s => !s)}
            activeOpacity={0.8}
          >
            <Text style={styles.speedBtnText}>{playbackSpeed}x</Text>
          </TouchableOpacity>
          {/* Fullscreen */}
          <TouchableOpacity onPress={toggleFullscreen} activeOpacity={0.8} style={styles.fullscreenBtn}>
            <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Speed picker popup */}
        {showSpeedPicker && (
          <View style={styles.speedPicker}>
            {SPEEDS.map(s => (
              <TouchableOpacity key={s} style={[styles.speedOption, playbackSpeed === s && styles.speedOptionActive]} onPress={() => changeSpeed(s)}>
                <Text style={[styles.speedOptionText, playbackSpeed === s && styles.speedOptionTextActive]}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
        colors={[...LESSON_BG_GRADIENT]}
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
        colors={[...LESSON_BG_GRADIENT]}
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
      colors={[...LESSON_BG_GRADIENT]}
      locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
      style={styles.gradientContainer}
    >
      <RNSafeAreaView style={styles.safeAreaContainer} edges={['top']}>
        {/* Header — זכוכית עם שוליים; בלי padding כפול ל-safe-area (כבר מטופל ב־SafeAreaView) */}
        <View style={styles.headerWrapper}>
          <UICard variant="blur" glassIntensity="subtle" padding="sm" style={styles.headerOuterBlur}>
            <View style={styles.headerRow}>
              <DayNavBlurButton onPress={() => navigation.goBack()} glassIntensity="subtle">
                <ArrowRight size={18} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </DayNavBlurButton>
              <View style={styles.headerTextBlock}>
                <Text style={styles.headerTitle} numberOfLines={2}>
                  {lesson.title}
                </Text>
                <Text style={styles.headerSubtitle}>
                  שיעור {currentBlockIndex + 1} מתוך {lesson.blocks?.length ?? 0}
                </Text>
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
            <UICard variant="elevated" padding="lg" style={styles.lessonPanel}>
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
            <UICard variant="elevated" padding="none" style={styles.lessonPanel}>
              {renderCurrentBlock()}
            </UICard>
          </View>

          {/* Personal Notes Card */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.lg }}>
            <UICard variant="elevated" padding="md" style={styles.lessonPanel}>
              <TouchableOpacity
                style={styles.notesHeader}
                onPress={() => setNotesExpanded(!notesExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.notesTitle}>הערות אישיות</Text>
                <View style={styles.notesHeaderIcons}>
                  {notesSaving && <ActivityIndicator size="small" color={DesignTokens.colors.text.tertiary} />}
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
                  <TextInput
                    style={styles.notesInput}
                    multiline
                    value={notes}
                    onChangeText={setNotes}
                    onBlur={saveNotes}
                    placeholder="כתוב הערות לשיעור זה..."
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    textAlign="right"
                    textAlignVertical="top"
                    returnKeyType="default"
                  />
                </View>
              )}
            </UICard>
          </View>

          {/* ניווט בלוקים — כמו מעבר הימים (חצים עגולים בזכוכית) */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingBottom: DesignTokens.spacing.lg }}>
            <UICard variant="blur" glassIntensity="subtle" padding="sm" style={styles.blockNavOuterBlur}>
              <View style={styles.blockNavRow}>
                <DayNavBlurButton
                  onPress={goToPreviousBlock}
                  disabled={currentBlockIndex === 0}
                  glassIntensity="subtle"
                >
                  <ChevronLeft
                    size={18}
                    color={currentBlockIndex === 0 ? DesignTokens.colors.text.tertiary : DesignTokens.colors.text.primary}
                    strokeWidth={2}
                  />
                </DayNavBlurButton>
                <View style={styles.blockNavCenter} />
                <DayNavBlurButton
                  onPress={goToNextBlock}
                  disabled={!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1}
                  glassIntensity="subtle"
                >
                  <ChevronRight
                    size={18}
                    color={
                      !lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1
                        ? DesignTokens.colors.text.tertiary
                        : DesignTokens.colors.text.primary
                    }
                    strokeWidth={2}
                  />
                </DayNavBlurButton>
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
    paddingHorizontal: tokens.layout?.screenPadding ?? tokens.spacing.lg,
    paddingTop: 8,
    paddingBottom: 8,
  },
  /** פאנל נייטרלי — לא blur ולא ירוק ממותג; רקע אחיד מתחת */
  lessonPanel: {
    backgroundColor: '#141414',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  /** כמו שורת היומן הכלכלי — כרטיס blur חיצוני */
  headerOuterBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  blockNavOuterBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  blockNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  blockNavCenter: {
    flex: 1,
    minWidth: 8,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.md,
    minHeight: 44,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: '700' as const,
    color: tokens.colors.text.primary,
    marginBottom: 2,
    lineHeight: Math.round(tokens.typography.fontSize.lg * 1.25),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headerSpacer: {
    width: DAY_NAV_BUTTON_SIZE,
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
  videoControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  playButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: tokens.colors.primary.main, justifyContent: 'center', alignItems: 'center' },
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
    color: tokens.colors.text.primary,
  },
  notesHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  notesContent: {
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  notesInput: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.primary,
    minHeight: 100,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingTop: 4,
  },
  // Speed + Fullscreen controls
  speedBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  speedBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  fullscreenBtn: {
    padding: 4,
  },
  speedPicker: {
    position: 'absolute',
    bottom: 52,
    left: 8,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 10,
    padding: 8,
    zIndex: 10,
  },
  speedOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  speedOptionActive: {
    backgroundColor: tokens.colors.primary.main,
  },
  speedOptionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  speedOptionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});

