import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, PanResponder, GestureResponderEvent, PanResponderGestureState, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, PlayCircle, Play, Pause, FileText } from 'lucide-react-native';
import { useDesignTokens } from '../ui/DesignTokens';
// import { MediaFile } from '../../services/mediaService';
import { Audio } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { logger } from '../../utils/logger';

interface MediaMessageRendererProps {
  message: {
    id: string;
    content?: string;
    file_url?: string;
    type: string;
    duration?: number;
    metadata?: any;
    sender?: {
      full_name?: string;
    };
  };
  isMe: boolean;
  onMediaPress: (media: any) => void;
  textDirection: 'rtl' | 'ltr';
  isGrouped?: boolean;
  isGroupStart?: boolean;
  isGroupEnd?: boolean;
}

export default function MediaMessageRenderer({ 
  message, 
  isMe, 
  onMediaPress, 
  textDirection,
  isGrouped,
  isGroupStart,
  isGroupEnd
}: MediaMessageRendererProps) {
  const DesignTokens = useDesignTokens();
  const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  // ====== Audio state ======
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0); // יתעדכן מהקובץ
  const [positionMs, setPositionMs] = useState(0);
  const progressPct = Math.max(0, Math.min(100, (positionMs / Math.max(1, durationMs)) * 100));
  
  // ====== Video thumbnail state ======
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);

  // Load audio duration when component mounts
  useEffect(() => {
    if (message.type === 'audio' && message.file_url) {
      const loadDuration = async () => {
        try {
          const { sound } = await Audio.Sound.createAsync({ uri: message.file_url! });
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            setDurationMs(status.durationMillis);
          }
          await sound.unloadAsync();
        } catch (error) {
          logger.error('MediaMessageRenderer', 'Failed to load audio duration', error);
        }
      };
      loadDuration();
    }
  }, [message.file_url, message.type]);

  // Load video thumbnail when component mounts
  useEffect(() => {
    if (message.type === 'video' && message.file_url && !videoThumbnail) {
      const generateThumbnail = async () => {
        try {
          // בדיקה אם זה URL מקומי או רחוק
          const isLocalFile = message.file_url?.startsWith('file://') || message.file_url?.startsWith('content://');
          
          // אם זה קובץ מקומי, נבדוק אם הוא קיים
          if (isLocalFile) {
            // ננסה ליצור thumbnail רק אם הקובץ קיים
            const { uri } = await VideoThumbnails.getThumbnailAsync(
              message.file_url!,
              {
                time: 1000, // 1 second into the video
                quality: 0.7,
              }
            );
            setVideoThumbnail(uri);
          } else if (message.file_url?.startsWith('http')) {
            // עבור קבצים מרחוק, ננסה ליצור thumbnail
            const { uri } = await VideoThumbnails.getThumbnailAsync(
              message.file_url!,
              {
                time: 1000,
                quality: 0.7,
              }
            );
            setVideoThumbnail(uri);
          }
        } catch (error) {
          logger.error('MediaMessageRenderer', 'Failed to generate video thumbnail', error);
        }
      };
      generateThumbnail();
    }
  }, [message.file_url, message.type, videoThumbnail]);

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  // Load audio lazily
  const ensureSound = async () => {
    if (soundRef.current) return soundRef.current;
    const { sound } = await Audio.Sound.createAsync({ uri: message.file_url! }, {}, async (status: any) => {
      if (status.isLoaded) {
        if (status.durationMillis && status.durationMillis > 0) {
          setDurationMs(status.durationMillis);
        }
        setPositionMs(status.positionMillis ?? 0);
        setIsPlaying(status.isPlaying ?? false);
        if (status.didJustFinish) {
          // סיים – איפוס להתחלה
          setIsPlaying(false);
          setPositionMs(0);
          try { await soundRef.current?.setPositionAsync(0); } catch (error) {
          logger.error('MediaMessageRenderer', 'Failed to reset audio position', error);
        }
        }
      }
    });
    soundRef.current = sound;
    const st = await sound.getStatusAsync();
    if (st.isLoaded && st.durationMillis && st.durationMillis > 0) {
      setDurationMs(st.durationMillis);
    }
    return sound;
  };

  const togglePlay = async () => {
    try {
      const sound = await ensureSound();
      const st = await sound.getStatusAsync();
      if (st.isLoaded && st.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else if (st.isLoaded) {
        if ((st.durationMillis ?? 0) > 0 && (st.durationMillis! - st.positionMillis!) < 500) {
          await sound.setPositionAsync(0);
          setPositionMs(0);
        }
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      logger.error('MediaMessageRenderer', 'togglePlay failed', e);
    }
  };

  // Drag to seek
  const [barWidthPx, setBarWidthPx] = useState(200); // רוחב פס ההתקדמות (נמדד בפועל)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async (e: GestureResponderEvent) => {
        const x = e.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / barWidthPx));
        const target = pct * durationMs;
        const s = await ensureSound();
        await s.setPositionAsync(target);
        setPositionMs(target);
      },
      onPanResponderMove: async (e: GestureResponderEvent, g: PanResponderGestureState) => {
        const x = Math.max(0, Math.min(barWidthPx, e.nativeEvent.locationX));
        const pct = x / barWidthPx;
        const target = pct * durationMs;
        setPositionMs(target);
      },
      onPanResponderRelease: async (e: GestureResponderEvent) => {
        const x = Math.max(0, Math.min(barWidthPx, e.nativeEvent.locationX));
        const pct = x / barWidthPx;
        const target = pct * durationMs;
        const s = await ensureSound();
        await s.setPositionAsync(target);
        setPositionMs(target);
      }
    })
  ).current;

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
      setPositionMs(0);
    };
  }, [message.id]);

  // Polling עדין כדי לעדכן את המחוון בזמן ניגון
  useEffect(() => {
    let timer: any;
    const tick = async () => {
      if (!soundRef.current) return;
      const st = await soundRef.current.getStatusAsync();
      if (st.isLoaded) {
        setPositionMs(st.positionMillis ?? 0);
        setDurationMs(st.durationMillis ?? durationMs);
        setIsPlaying(st.isPlaying ?? false);
      }
    };
    if (isPlaying) {
      timer = setInterval(tick, 200);
    }
    return () => timer && clearInterval(timer);
  }, [isPlaying]);
  
  const renderImageMessage = () => (
    <View style={{
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.bubbleOther,
      marginBottom: 4
    }}>
      {/* שם השולח מעל התמונה (רק לאחרים ורק אם זה תחילת קבוצה) */}
      {!isMe && (!isGrouped || isGroupStart) && (
        <Text 
          style={{ 
            textAlign: 'right',
            writingDirection: 'rtl',
            color: DesignTokens.colors.success.main,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 4,
            paddingHorizontal: 12,
            paddingTop: 10
          }}
        >
          {message.sender?.full_name || 'משתמש'}
        </Text>
      )}
      <Pressable onPress={() => {
        if (message.file_url) {
          onMediaPress({
            id: message.id,
            uri: message.file_url,
            type: 'image',
            name: message.content || 'תמונה'
          });
        }
      }}>
        {message.file_url ? (
          <Image 
            source={{ uri: message.file_url }} 
            style={{ 
              width: 240, 
              height: 240, 
              alignSelf: 'center',
              borderRadius: 12
            }} 
            resizeMode="cover"
            onError={(error) => {
              // אם יש שגיאה, נציג fallback במקום לוג
              // השגיאה כבר מטופלת על ידי React Native
            }}
            onLoadStart={() => {
              // התמונה מתחילה להיטען
            }}
          />
        ) : (
          <View style={{ 
            width: 240, 
            height: 240, 
            backgroundColor: DesignTokens.colors.background.primary,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center',
            borderRadius: 12
          }}>
            <ImageIcon size={48} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
          </View>
        )}
      </Pressable>
      {message.content && message.content !== '[image]' ? (
        <Text style={{ 
          color: isMe ? '#000000' : '#FFFFFF', 
          textAlign: isMe ? (textDirection === 'rtl' ? 'right' : 'left') : 'right',
          writingDirection: textDirection,
          fontSize: 13,
          fontWeight: '400',
          paddingHorizontal: 12,
          paddingBottom: 10,
          paddingTop: 6,
          lineHeight: 18
        }}>
          {message.content}
        </Text>
      ) : null}
    </View>
  );

  const renderVideoMessage = () => (
    <View style={{
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.bubbleOther,
      marginBottom: 4
    }}>
      {/* שם השולח מעל הווידאו (רק לאחרים ורק אם זה תחילת קבוצה) */}
      {!isMe && (!isGrouped || isGroupStart) && (
        <Text 
          style={{ 
            textAlign: 'right',
            writingDirection: 'rtl',
            color: DesignTokens.colors.success.main,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 4,
            paddingHorizontal: 12,
            paddingTop: 10
          }}
        >
          {message.sender?.full_name || 'משתמש'}
        </Text>
      )}

      <Pressable onPress={() => {
        if (message.file_url) {
          onMediaPress({
            id: message.id,
            uri: message.file_url,
            type: 'video',
            name: message.content || 'וידאו'
          });
        }
      }}>
        <View style={{ 
          width: 240, 
          height: 160, 
          backgroundColor: DesignTokens.colors.background.primary,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 12
        }}>
          {videoThumbnail ? (
            <>
              <Image
                source={{ uri: videoThumbnail }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="cover"
              />
              {/* גרדיאנט שחור מעל התמונה */}
              <LinearGradient
                colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)']} // שמירה על שקיפות שחורה לתמונה
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                pointerEvents="none"
              />
            </>
          ) : (
            <View style={{ 
              width: '100%', 
              height: '100%', 
              backgroundColor: DesignTokens.colors.background.primary,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <PlayCircle size={48} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
            </View>
          )}
          {/* כפתור Play */}
          <View style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [{ translateX: -24 }, { translateY: -24 }],
            width: 48,
            height: 48,
            backgroundColor: DesignTokens.colors.success.main,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Play size={20} color={DesignTokens.colors.text.primary} strokeWidth={2.5} />
          </View>
        </View>
      </Pressable>
      {message.content && message.content !== '[video]' ? (
        <Text style={{ 
          color: isMe ? '#000000' : '#FFFFFF', 
          textAlign: isMe ? (textDirection === 'rtl' ? 'right' : 'left') : 'right',
          writingDirection: textDirection,
          fontSize: 13,
          fontWeight: '400',
          paddingHorizontal: 12,
          paddingBottom: 10,
          paddingTop: 6,
          lineHeight: 18
        }}>
          {message.content}
        </Text>
      ) : null}
    </View>
  );

  const renderAudioMessage = () => (
    <View
      style={{
        width: 280, // הורחב מ-260 ל-280 כדי לתת יותר מקום ל-waveforms
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: -5,
        backgroundColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.bubbleOther,
        alignSelf: 'center'
      }}
    >
      {/* שם השולח (רק לאחרים ורק אם זה תחילת קבוצה) */}
      {!isMe && (!isGrouped || isGroupStart) && (
        <Text 
          style={{ 
            textAlign: 'right',
            writingDirection: 'rtl',
            color: DesignTokens.colors.success.main,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 2,
            paddingHorizontal: 12,
            paddingTop: 10
          }}
        >
          {message.sender?.full_name || 'משתמש'}
        </Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 }}>
        {/* Play Button */}
        <Pressable
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isMe ? '#000000' : DesignTokens.colors.success.main,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
            zIndex: 10 // ודא שהכפתור תמיד מעל ה-waveforms
          }}
          onPress={togglePlay}
        >
          {isPlaying ? (
            <Ionicons name="pause" size={20} color={isMe ? DesignTokens.colors.success.main : "#000000"} />
          ) : (
            <Ionicons name="play" size={20} color={isMe ? DesignTokens.colors.success.main : "#000000"} style={{ marginLeft: 2 }} />
          )}
        </Pressable>

        {/* Waveforms - תמיד מציג waveforms */}
        <View style={{ flex: 1, marginLeft: 4 }}> {/* הוספתי marginLeft כדי לתת יותר רווח מהכפתור */}
          <View style={{ marginBottom: 4 }}>
            <View
              {...panResponder.panHandlers}
              style={{
                height: 24, // הוגדל מ-20 ל-24 כדי לתת יותר מקום ל-waveforms
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minWidth: 180, // רוחב מינימלי כדי למנוע דחיסה
                paddingRight: 4 // הוספתי padding כדי למנוע דחיסה מהכפתור
              }}
              onLayout={(e) => setBarWidthPx(e.nativeEvent.layout.width)}
            >
              {/* יצירת waveforms - אם יש waveformData, משתמשים בו, אחרת יוצרים אקראיים */}
              {(() => {
                const BARS_COUNT = 30;
                const waveformData = message.metadata?.waveformData && Array.isArray(message.metadata.waveformData) 
                  ? message.metadata.waveformData 
                  : Array.from({ length: BARS_COUNT }, () => 0.3 + Math.random() * 0.7);
                
                return waveformData.map((value: number, index: number) => {
                  // חישוב גובה ה-bar בהתאם למיקום הנוכחי
                  const barPosition = (index / waveformData.length) * 100;
                  const isPlayed = barPosition <= progressPct;
                  const barHeight = Math.max(4, value * 16);
                  
                  return (
                    <View
                      key={index}
                      style={{
                        width: 3,
                        height: barHeight,
                        backgroundColor: isPlayed 
                          ? (isMe ? '#000000' : DesignTokens.colors.success.main)
                          : (isMe ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'),
                        borderRadius: 1.5,
                        opacity: isPlayed ? 1 : 0.5
                      }}
                    />
                  );
                });
              })()}
            </View>
            {/* זמן נוכחי / סה"כ */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ 
                color: isMe ? '#000000' : DesignTokens.colors.text.tertiary, 
                fontSize: 10, 
                fontWeight: '500' 
              }}>
                {formatMs(durationMs)}
              </Text>
              <Text style={{ 
                color: isMe ? '#000000' : '#FFFFFF', 
                fontSize: 10, 
                fontWeight: '600' 
              }}>
                {formatMs(positionMs)}
              </Text>
            </View>
          </View>
        </View>
      </View>

    </View>
  );

  const renderDocumentMessage = () => (
    <View style={{ 
      borderRadius: 18, 
      overflow: 'hidden', 
      backgroundColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.bubbleOther,
      marginBottom: 4,
      alignSelf: 'center',
      width: 260
    }}>
      {/* שם השולח (רק לאחרים ורק אם זה תחילת קבוצה) */}
      {!isMe && (!isGrouped || isGroupStart) && (
        <Text 
          style={{ 
            textAlign: 'right',
            writingDirection: 'rtl',
            color: DesignTokens.colors.success.main,
            fontSize: 12,
            fontWeight: '700',
            marginBottom: 2,
            paddingHorizontal: 12,
            paddingTop: 10
          }}
        >
          {message.sender?.full_name || 'משתמש'}
        </Text>
      )}

      <Pressable onPress={() => {
        if (message.file_url) {
          onMediaPress({
            id: message.id,
            uri: message.file_url,
            type: 'document',
            name: message.content || 'מסמך'
          });
        }
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            backgroundColor: isMe ? '#000000' : DesignTokens.colors.success.main, 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: 10
          }}>
            <FileText size={20} color={isMe ? DesignTokens.colors.success.main : '#000000'} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: isMe ? '#000000' : '#FFFFFF', 
              fontWeight: '700', 
              fontSize: 13, 
              marginBottom: 3,
              textAlign: 'right'
            }} numberOfLines={1} ellipsizeMode="tail">
              {(message.content && message.content !== '[document]') ? message.content : (message.file_url?.split('/').pop() || 'מסמך')}
            </Text>
            <Text style={{ 
              color: isMe ? 'rgba(0,0,0,0.6)' : DesignTokens.colors.text.tertiary, 
              fontSize: 11, 
              fontWeight: '500',
              textAlign: 'right'
            }} numberOfLines={1}>
              {message.file_url?.split('.').pop()?.toUpperCase() || 'FILE'}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );

  switch (message.type) {
    case 'image':
      return renderImageMessage();
    case 'video':
      return renderVideoMessage();
    case 'audio':
      return renderAudioMessage();
    case 'document':
      return renderDocumentMessage();
    default:
      return null;
  }
}
