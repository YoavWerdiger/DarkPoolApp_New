import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, Play, FileText, Download } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
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

export default function MediaBubble({
  mediaUrl,
  mediaType,
  caption,
  metadata,
  isMe
}: MediaBubbleProps) {
  const DesignTokens = useDesignTokens();
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [audioStatus, setAudioStatus] = useState(false);
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

        // עצור אוטומטית בסיום
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setAudioStatus(false);
          }
        });
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
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

  const [thumbUri, setThumbUri] = useState<string | null>(null);

  useEffect(() => {
    const gen = async () => {
      if (mediaType !== 'video') return;
      try {
        // dynamic import to avoid bundler error if package not installed yet
        const mod: any = await import('expo-video-thumbnails');
        if (mod && typeof mod.getThumbnailAsync === 'function') {
          const { uri } = await mod.getThumbnailAsync(mediaUrl, { time: 1000 });
          setThumbUri(uri);
        }
      } catch (e) {
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
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: DesignTokens.colors.border.primary
                }}
                resizeMode="cover"
                onError={(error) => {
                  console.error('Image load error in MediaBubble:', error);
                }}
              />
            ) : (
              <View style={{
                width: Math.min(metadata?.width || maxImageWidth, maxImageWidth),
                height: Math.min(metadata?.height || maxImageHeight, maxImageHeight),
                borderRadius: 12,
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
                  onError={(error) => {
                    console.error('Video thumbnail load error in MediaBubble:', error);
                  }}
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
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 12
              }}>
                <View style={{
                  width: 48,
                  height: 48,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Play size={24} color="#000" strokeWidth={2} />
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
            borderRadius: 12,
            padding: 12,
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
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}
            >
              <Ionicons
                name={audioStatus ? 'pause' : 'play'}
                size={20}
                color="white"
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={{
                height: 4,
                backgroundColor: DesignTokens.colors.background.primary,
                borderRadius: 2,
                marginBottom: 6,
                overflow: 'hidden'
              }}>
                <View style={{
                  height: 4,
                  backgroundColor: DesignTokens.colors.primary.main,
                  borderRadius: 2,
                  width: '30%'
                }} />
              </View>
              <Text style={{
                color: DesignTokens.colors.text.secondary,
                fontSize: 12
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
              borderRadius: 12,
              padding: 12,
              minWidth: 200,
              borderWidth: 1,
              borderColor: DesignTokens.colors.border.primary
            }}>
              <View style={{
                width: 40,
                height: 40,
                backgroundColor: DesignTokens.colors.primary.main,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <FileText size={20} color="white" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: DesignTokens.colors.text.primary,
                  fontWeight: '500',
                  fontSize: 14,
                  marginBottom: 2
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
            borderRadius: 12,
            padding: 12
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
              fontSize: 14,
              marginTop: 6,
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
