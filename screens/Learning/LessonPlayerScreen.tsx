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
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { useLesson, useSaveProgress, useGetSignedUrl } from '../../hooks/useLearning';
import { LessonWithProgress, BlockType } from '../../types/learning';
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react-native';

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
        <View style={styles.blockErrorContainer}>
          <Text style={styles.blockErrorText}>וידאו לא זמין</Text>
        </View>
      );
    }

    if (isLoadingVideo) {
      return (
        <View style={styles.blockLoadingContainer}>
          <ActivityIndicator size="large" color="#00E654" />
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
              handleVideoProgress(status.positionMillis / 1000);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E654" />
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
      {/* Header - SwiftUI Style */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2} />
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
      </SafeAreaView>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.contentCard}>
          {renderCurrentBlock()}
        </View>
      </View>

      {/* Video Controls - SwiftUI Style */}
      {currentBlock?.type === 'video' && (
        <View style={styles.videoControlsContainer}>
          <View style={styles.videoControls}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause size={24} color="#000000" strokeWidth={2} />
              ) : (
                <Play size={24} color="#000000" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Navigation - SwiftUI Style */}
      <View style={styles.navigationContainer}>
        <View style={styles.navigation}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentBlockIndex === 0 && styles.navButtonDisabled
          ]}
          onPress={goToPreviousBlock}
          disabled={currentBlockIndex === 0}
        >
          <ChevronLeft size={20} color={currentBlockIndex === 0 ? "#666666" : "#00E654"} strokeWidth={2} />
          <Text style={[
            styles.navButtonText,
            currentBlockIndex === 0 && styles.navButtonTextDisabled
          ]}>
            הקודם
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
            הבא
          </Text>
          <ChevronRight size={20} color={(!lesson.blocks || currentBlockIndex >= lesson.blocks.length - 1) ? "#666666" : "#00E654"} strokeWidth={2} />
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  headerSafeArea: {
    backgroundColor: '#1C1C1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#A0A0A0',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  blockInfo: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 4,
    textAlign: 'right',
  },
  content: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    padding: 20,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: (screenWidth * 9) / 16, // 16:9 aspect ratio
    backgroundColor: '#000',
  },
  textContainer: {
    flex: 1,
    padding: 20,
  },
  textContent: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    textAlign: 'right',
  },
  pdfContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  blockErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  blockErrorText: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  blockLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  blockLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#A0A0A0',
  },
  pdfText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  pdfSubtext: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    marginBottom: 24,
  },
  downloadButton: {
    backgroundColor: '#00E654',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  quizContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  quizText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  quizSubtext: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    marginBottom: 24,
  },
  quizButton: {
    backgroundColor: '#00E654',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  quizButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  videoControlsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00E654',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E654',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navigationContainer: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonTextDisabled: {
    color: '#666666',
  },
});

