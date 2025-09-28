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
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { useLesson, useSaveProgress, useGetSignedUrl } from '../../hooks/useLearning';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { LessonWithProgress, BlockType } from '../../types/learning';

const { width: screenWidth } = Dimensions.get('window');

export const LessonPlayerScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { lessonId, initialBlockIndex = 0 } = route.params as { 
    lessonId: string; 
    initialBlockIndex?: number;
  };
  
  const [currentBlockIndex, setCurrentBlockIndex] = useState(initialBlockIndex);
  const [videoPosition, setVideoPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

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
    
    // Save progress every 5 seconds
    if (Math.floor(position) % 5 === 0) {
      saveProgressMutation.mutate({
        lesson_id: lessonId,
        status: 'in_progress',
        last_position_seconds: Math.floor(position)
      });
    }
  }, [lessonId, saveProgressMutation]);

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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>וידאו לא זמין</Text>
        </View>
      );
    }

    if (isLoadingVideo) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary} />
          <Text style={styles.loadingText}>טוען וידאו...</Text>
        </View>
      );
    }

    if (!signedUrl) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>לא ניתן לטעון את הוידאו</Text>
        </View>
      );
    }

    return (
      <Video
        style={styles.video}
        source={{ uri: signedUrl }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isPlaying}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            handleVideoProgress(status.positionMillis / 1000);
            if (status.didJustFinish) {
              handleVideoComplete();
            }
          }
        }}
        posterSource={currentBlock.video_poster_url ? { uri: currentBlock.video_poster_url } : undefined}
        usePoster={true}
      />
    );
  };

  const renderTextBlock = () => {
    if (!currentBlock?.text_md) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>תוכן לא זמין</Text>
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>תוכן לא זמין</Text>
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
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>סוג תוכן לא נתמך</Text>
          </View>
        );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary} />
        <Text style={styles.loadingText}>טוען שיעור...</Text>
      </View>
    );
  }

  if (error || !lesson) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>שגיאה בטעינת השיעור</Text>
        <Text style={styles.errorMessage}>
          {error?.message || 'השיעור לא נמצא'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.25)', 'transparent', 'rgba(0, 230, 84, 0.15)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.lessonTitle} numberOfLines={2}>
            {lesson.title}
          </Text>
          <Text style={styles.blockInfo}>
            {currentBlockIndex + 1} מתוך {lesson.blocks?.length || 0}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderCurrentBlock()}
      </View>

      {/* Video Controls */}
      {currentBlock?.type === 'video' && (
        <View style={styles.videoControls}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => setIsPlaying(!isPlaying)}
          >
            <Text style={styles.playButtonText}>
              {isPlaying ? '⏸️' : '▶️'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navigation}>
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
            ← הקודם
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            (!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1) && styles.navButtonDisabled
          ]}
          onPress={goToNextBlock}
          disabled={!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1}
        >
          <Text style={[
            styles.navButtonText,
            (!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1) && styles.navButtonTextDisabled
          ]}>
            הבא →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.background,
  },
  loadingText: {
    marginTop: DesignTokens.spacing.md,
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.lg,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: DesignTokens.spacing.lg,
  },
  errorTitle: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: DesignTokens.layout.borderWidth.normal,
    borderBottomColor: DesignTokens.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: DesignTokens.borderRadius.full,
    backgroundColor: DesignTokens.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: DesignTokens.spacing.md,
    borderWidth: DesignTokens.layout.borderWidth.normal,
    borderColor: DesignTokens.colors.border,
  },
  backButtonText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    color: DesignTokens.colors.textPrimary,
    fontWeight: DesignTokens.typography.fontWeight.bold,
  },
  headerContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    textAlign: 'right',
  },
  blockInfo: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    marginTop: DesignTokens.spacing.xs,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: (screenWidth * 9) / 16, // 16:9 aspect ratio
    backgroundColor: '#000',
  },
  textContainer: {
    flex: 1,
    padding: DesignTokens.spacing.lg,
  },
  textContent: {
    fontSize: DesignTokens.typography.fontSize.base,
    color: DesignTokens.colors.textPrimary,
    lineHeight: DesignTokens.typography.lineHeight.relaxed * DesignTokens.typography.fontSize.base,
    textAlign: 'right',
  },
  pdfContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignTokens.spacing.lg,
  },
  pdfText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
  },
  pdfSubtext: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: DesignTokens.spacing.lg,
  },
  downloadButton: {
    backgroundColor: DesignTokens.colors.primary,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
  },
  downloadButtonText: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  quizContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DesignTokens.spacing.lg,
  },
  quizText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.sm,
  },
  quizSubtext: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: DesignTokens.spacing.lg,
  },
  quizButton: {
    backgroundColor: DesignTokens.colors.info,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
  },
  quizButtonText: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: DesignTokens.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: DesignTokens.borderRadius.full,
    backgroundColor: DesignTokens.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: DesignTokens.layout.borderWidth.normal,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  playButtonText: {
    fontSize: DesignTokens.typography.fontSize.lg,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    backgroundColor: 'transparent',
    borderTopWidth: DesignTokens.layout.borderWidth.normal,
    borderTopColor: DesignTokens.colors.border,
  },
  navButton: {
    backgroundColor: DesignTokens.colors.elevated,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    borderRadius: DesignTokens.borderRadius.lg,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: DesignTokens.layout.borderWidth.normal,
    borderColor: DesignTokens.colors.border,
  },
  navButtonDisabled: {
    backgroundColor: DesignTokens.colors.border,
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.medium,
    color: DesignTokens.colors.textPrimary,
  },
  navButtonTextDisabled: {
    color: DesignTokens.colors.textMuted,
  },
});

