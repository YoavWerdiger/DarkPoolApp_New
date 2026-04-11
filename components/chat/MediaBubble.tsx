import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, Play, FileText, Download } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { logger } from '../../utils/logger';
import { Audio } from 'expo-av';
import MediaViewer from './MediaViewer';
import { useDesignTokens } from '../ui/DesignTokens';

interface MediaBubbleProps {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  metadata?: {
    file_name?: string;
    file_size?: number;
    duration?: number;
    width?: number;
    height?: number;
  };
  isMe: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const maxImageWidth = screenWidth * 0.6;
const maxImageHeight = 300;

// Module-level cache so thumbnails aren't re-generated on remount
const thumbnailCache = new Map<string, string>();

function MediaBubble({
  mediaUrl,
  mediaType,
  caption,
  metadata,
  isMe
}: MediaBubbleProps) {
  const DesignTokens = useDesignTokens();
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [audioStatus, setAudioStatus] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0); // seconds
  const [audioDuration, setAudioDuration] = useState(0); // seconds
  const audioRef = useRef<Audio.Sound | null>(null);

  // פורמט גודל קובץ
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // פורמט משך זמן
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // נגינת/עצירת אודיו
  const toggleAudio = async () => {
    try {
      if (audioStatus) {
        // עצור אודיו
        if (audioRef.current) {
          await audioRef.current.stopAsync();
          await audioRef.current.unloadAsync();
        }
        setAudioStatus(false);
      } else {
        // התחל אודיו
        const { sound } = await Audio.Sound.createAsync({ uri: mediaUrl });
        audioRef.current = sound;
        await sound.playAsync();
        setAudioStatus(true);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            if (status.durationMillis) setAudioDuration(status.durationMillis / 1000);
            setAudioPosition(status.positionMillis / 1000);
            if (status.didJustFinish) {
              setAudioStatus(false);
              setAudioPosition(0);
            }
          }
        });
      }
    } catch (error) {
      logger.error('MediaBubble', 'Error toggling audio', error);
    }
  };

  // פתיחת MediaViewer
  const openMediaViewer = () => {
    setShowMediaViewer(true);
  };

  // ניקוי אודיו בעת סגירה
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.unloadAsync();
      }
    };
  }, []);

  const [thumbUri, setThumbUri] = useState<string | null>(() =>
    thumbnailCache.get(mediaUrl) ?? null
  );

  useEffect(() => {
    if (mediaType !== 'video') return;
    if (thumbnailCache.has(mediaUrl)) {
      setThumbUri(thumbnailCache.get(mediaUrl)!);
      return;
    }
    const gen = async () => {
      try {
        const mod: any = await import('expo-video-thumbnails');
        if (mod && typeof mod.getThumbnailAsync === 'function') {
          const { uri } = await mod.getThumbnailAsync(mediaUrl, { time: 1000 });
          thumbnailCache.set(mediaUrl, uri);
          setThumbUri(uri);
        }
      } catch {
        // fallback: no thumbnail available
      }
    };
    gen();
  }, [mediaUrl, mediaType]);

  const renderMediaContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <Pressable onPress={openMediaViewer}>
            {mediaUrl ? (
              <Image
                source={{ uri: mediaUrl }}
                style={{
                  width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                  height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                  borderRadius: DesignTokens.borderRadius.md,
                  borderWidth: 1,
                  borderColor: DesignTokens.colors.border.primary
                }}
                resizeMode="cover"
                onError={() => {}}
              />
            ) : (
              <View style={{
                width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                borderRadius: DesignTokens.borderRadius.md,
                backgroundColor: DesignTokens.colors.background.tertiary,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: DesignTokens.colors.border.primary
              }}>
                <ImageIcon size={32} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
              </View>
            )}
          </Pressable>
        );

      case 'video':
        return (
          <Pressable onPress={openMediaViewer}>
            <View style={{ position: 'relative' }}>
              {thumbUri && thumbUri.trim() !== '' ? (
                <Image
                  source={{ uri: thumbUri }}
                  style={{
                    width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                    height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: DesignTokens.colors.border.primary
                  }}
                  resizeMode="cover"
                  onError={() => {}}
                />
              ) : (
                <View style={{
                  width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                  height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                  borderRadius: 12,
                  backgroundColor: '#111',
                  borderWidth: 1,
                  borderColor: DesignTokens.colors.border.primary
                }} />
              )}
              <View style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: DesignTokens.colors.backdrop,
                borderRadius: DesignTokens.borderRadius.md
              }}>
                <View style={{
                  width: 48,
                  height: 48,
                  backgroundColor: DesignTokens.colors.text.primary,
                  borderRadius: DesignTokens.borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Play size={24} color={DesignTokens.colors.text.inverse} strokeWidth={2} />
                </View>
              </View>
            </View>
          </Pressable>
        );

      case 'audio':
        return (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: DesignTokens.colors.background.tertiary,
            borderRadius: DesignTokens.borderRadius.md,
            padding: DesignTokens.spacing.md,
            minWidth: 200,
            borderWidth: 1,
            borderColor: DesignTokens.colors.border.primary
          }}>
            <Pressable
              onPress={toggleAudio}
              style={{
                width: 40,
                height: 40,
                backgroundColor: DesignTokens.colors.primary.main,
                borderRadius: DesignTokens.borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: DesignTokens.spacing.md
              }}
            >
              <Ionicons
                name={audioStatus ? 'pause' : 'play'}
                size={20}
                color={DesignTokens.colors.text.inverse}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={{
                height: 4,
                backgroundColor: DesignTokens.colors.background.primary,
                borderRadius: DesignTokens.borderRadius.full,
                marginBottom: DesignTokens.spacing.xs + DesignTokens.spacing.micro,
                overflow: 'hidden'
              }}>
                <View style={{
                  height: 4,
                  backgroundColor: DesignTokens.colors.primary.main,
                  borderRadius: DesignTokens.borderRadius.full,
                  width: `${audioDuration > 0 ? Math.min((audioPosition / audioDuration) * 100, 100) : 0}%`,
                }} />
              </View>
              <Text style={{
                color: DesignTokens.colors.text.secondary,
                fontSize: DesignTokens.typography.fontSize.sm
              }}>
                {metadata?.duration ? formatDuration(metadata.duration) : '0:00'}
              </Text>
            </View>
          </View>
        );

      case 'document':
        return (
          <Pressable onPress={openMediaViewer}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: DesignTokens.colors.background.tertiary,
              borderRadius: DesignTokens.borderRadius.md,
              padding: DesignTokens.spacing.md,
              minWidth: 200,
              borderWidth: 1,
              borderColor: DesignTokens.colors.border.primary
            }}>
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: DesignTokens.colors.primary.main,
                borderRadius: DesignTokens.borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: DesignTokens.spacing.md
              }}>
                <FileText size={20} color={DesignTokens.colors.text.inverse} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: DesignTokens.colors.text.primary,
                  fontWeight: '500',
                  fontSize: DesignTokens.typography.bodySmall.size,
                  marginBottom: DesignTokens.spacing.micro
                }} numberOfLines={1}>
                  {metadata?.file_name || 'מסמך'}
                </Text>
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  fontSize: 11
                }}>
                  {metadata?.file_size ? formatFileSize(metadata.file_size) : 'גודל לא ידוע'}
                </Text>
              </View>
              <Download size={20} color={DesignTokens.colors.success.main} strokeWidth={2} />
            </View>
          </Pressable>
        );

      default:
        return (
          <View style={{
            backgroundColor: DesignTokens.colors.background.tertiary,
            borderRadius: DesignTokens.borderRadius.md,
            padding: DesignTokens.spacing.md
          }}>
            <Text style={{ color: DesignTokens.colors.text.primary }}>סוג מדיה לא נתמך</Text>
          </View>
        );
    }
  };

  return (
    <>
      <View style={{
        maxWidth: '80%',
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        marginLeft: isMe ? 'auto' : 0,
        marginRight: isMe ? 0 : 'auto'
      }}>
        {renderMediaContent()}

        {/* Caption */}
        {caption && (
          <Text
            style={{
              color: DesignTokens.colors.text.primary,
              fontSize: DesignTokens.typography.bodySmall.size,
              marginTop: DesignTokens.spacing.xs + DesignTokens.spacing.micro,
              textAlign: isMe ? 'right' : 'left'
            }}
          >
            {caption}
          </Text>
        )}
      </View>

      {/* Media Viewer Modal */}
      <MediaViewer
        visible={showMediaViewer}
        onClose={() => setShowMediaViewer(false)}
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        caption={caption}
      />
    </>
  );
}

export default React.memo(MediaBubble);
