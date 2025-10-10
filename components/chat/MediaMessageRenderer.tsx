import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageIcon, PlayCircle, Play, Pause, FileText } from 'lucide-react-native';
import { DesignTokens } from '../ui/DesignTokens';
// import { MediaFile } from '../../services/mediaService';
import { Audio } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { LinearGradient } from 'expo-linear-gradient';

interface MediaMessageRendererProps {
  message: {
    id: string;
    content?: string;
    file_url?: string;
    type: string;
    duration?: number;
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
          console.log('🎵 Loading duration from file:', message.file_url);
          const { sound } = await Audio.Sound.createAsync({ uri: message.file_url! });
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            setDurationMs(status.durationMillis);
            console.log('🎵 Duration loaded from file:', status.durationMillis);
          }
          await sound.unloadAsync();
        } catch (error) {
          console.log('Error loading audio duration:', error);
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
          const { uri } = await VideoThumbnails.getThumbnailAsync(
            message.file_url!,
            {
              time: 1000, // 1 second into the video
              quality: 0.7,
            }
          );
          setVideoThumbnail(uri);
        } catch (error) {
          console.log('Error generating video thumbnail:', error);
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
          try { await soundRef.current?.setPositionAsync(0); } catch {}
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
    const sound = await ensureSound();
    const st = await sound.getStatusAsync();
    if (st.isLoaded && st.isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else if (st.isLoaded) {
      // אם אנחנו קרובים לסוף – התחל מהתחלה
      if ((st.durationMillis ?? 0) > 0 && (st.durationMillis! - st.positionMillis!) < 500) {
        await sound.setPositionAsync(0);
        setPositionMs(0);
      }
      await sound.playAsync();
      setIsPlaying(true);
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
    };
  }, []);

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
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isMe ? 'rgba(0,230,84,0.1)' : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: isMe ? 'rgba(0,230,84,0.2)' : 'rgba(255,255,255,0.1)',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4
    }}>
      {/* שם השולח מעל התמונה (רק לאחרים ורק אם זה תחילת קבוצה) */}
      {!isMe && (!isGrouped || isGroupStart) && (
        <Text 
          style={{ 
            textAlign: 'right',
            writingDirection: 'rtl',
            color: '#00E654',
            fontSize: 13,
            fontWeight: 'bold',
            marginBottom: 8,
            paddingHorizontal: 12,
            paddingTop: 8
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
              width: 220, 
              height: 220, 
              alignSelf: 'center'
            }} 
            resizeMode="cover"
            onError={(error) => {
              console.error('Image load error in MediaMessageRenderer:', error);
            }}
          />
        ) : (
          <View style={{ 
            width: 220, 
            height: 220, 
            backgroundColor: '#2A2A2A',
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center'
          }}>
            <ImageIcon size={48} color="#666" strokeWidth={1.5} />
          </View>
        )}
      </Pressable>
      {message.content && message.content !== '[image]' ? (
        <Text style={{ 
          color: isMe ? '#000000' : '#FFFFFF', 
          textAlign: 'right',
          writingDirection: textDirection,
          fontSize: 13,
          fontWeight: '400',
          paddingHorizontal: 12,
          paddingBottom: 8,
          lineHeight: 18
        }}>
          {message.content}
        </Text>
      ) : null}
    </View>
  );

  const renderVideoMessage = () => (
    <View style={{
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isMe ? 'rgba(0,230,84,0.1)' : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: isMe ? 'rgba(0,230,84,0.2)' : 'rgba(255,255,255,0.1)',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4
    }}>
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
          width: 260, 
          height: 160, 
          backgroundColor: '#2A2A2A',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden'
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
                colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)']}
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
              backgroundColor: isMe ? '#1F1F1F' : '#181818',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <PlayCircle size={48} color={isMe ? "#00E654" : "#888888"} strokeWidth={1.5} />
            </View>
          )}
          <View style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [{ translateX: -20 }, { translateY: -20 }],
            width: 40,
            height: 40,
            backgroundColor: isMe ? '#00E654' : '#181818',
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: isMe ? '#00E654' : '#181818',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6
          }}>
            <Play size={18} color={isMe ? "#181818" : "#00E654"} strokeWidth={3} />
          </View>
        </View>
      </Pressable>
      {message.content && message.content !== '[video]' ? (
        <Text style={{ 
          color: isMe ? '#000000' : '#FFFFFF', 
          textAlign: 'right',
          writingDirection: textDirection,
          fontSize: 13,
          fontWeight: '400',
          paddingHorizontal: 12,
          paddingBottom: 8,
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
        width: 280,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 8,
        backgroundColor: isMe ? 'rgba(0, 212, 77,0.6)' : 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: isMe ? 'rgba(0,230,84,0.6)' : 'rgba(255,255,255,0.1)',
        borderLeftWidth: isMe ? 3 : 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        alignSelf: 'center'
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        {/* Play Button */}
        <Pressable
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isMe ? '#000' : '#00E654',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
            shadowColor: isMe ? '#000' : '#00E654',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3
          }}
          onPress={togglePlay}
        >
          {isPlaying ? <Pause size={20} color={isMe ? "#00E654" : "#000"} strokeWidth={2} /> : <Play size={20} color={isMe ? "#00E654" : "#000"} strokeWidth={2} />}
        </Pressable>

        {/* Timeline */}
        <View style={{ flex: 1 }}>
          {/* זמן נוכחי / סה"כ */}
          <View style={{ flexDirection: 'row-reverse', marginBottom: 8 }}>
            <Text style={{ color: isMe ? '#000' : '#fff', fontSize: 12, fontWeight: '500' }}>{formatMs(positionMs)} / {formatMs(durationMs)}</Text>
          </View>
          {/* פס התקדמות עם דוט */}
          <View
            {...panResponder.panHandlers}
            style={{ height: 20, justifyContent: 'center' }}
            onLayout={(e) => setBarWidthPx(e.nativeEvent.layout.width)}
          >
            <View style={{ height: 6, backgroundColor: isMe ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)', borderRadius: 3, width: '100%' }} />
            <View style={{ position: 'absolute', height: 6, backgroundColor: isMe ? '#000' : '#00E654', borderRadius: 3, width: (progressPct / 100) * barWidthPx }} />
            <View style={{ 
              position: 'absolute', 
              left: (progressPct / 100) * barWidthPx - 8, 
              width: 16, 
              height: 16, 
              borderRadius: 8, 
              backgroundColor: isMe ? '#000' : '#00E654',
              shadowColor: isMe ? '#000' : '#00E654',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.4,
              shadowRadius: 2,
              elevation: 2
            }} />
          </View>
        </View>
      </View>

    </View>
  );

  const renderDocumentMessage = () => (
    <View style={{ 
      borderRadius: 16, 
      overflow: 'hidden', 
      backgroundColor: isMe ? 'rgba(0, 230, 84, 0.5)' : 'rgba(255,255,255,0.08)', 
      borderWidth: 1,
      borderColor: isMe ? 'rgba(0, 230, 84, 0.6)' : 'rgba(255,255,255,0.1)',
      marginBottom: 8, 
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
      alignSelf: 'center' 
    }}>
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
        <View style={{ width: 280, minHeight: 80, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 }}>
            <View style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 12, 
            backgroundColor: isMe ? '#000' : '#00E654', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: 16,
            shadowColor: isMe ? '#000' : '#00E654',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 2
          }}>
            <FileText size={22} color={isMe ? '#00E654' : '#000'} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: isMe ? '#000' : '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 }} numberOfLines={1} ellipsizeMode="tail">
              {(message.content && message.content !== '[document]') ? message.content : (message.file_url?.split('/').pop() || 'מסמך')}
            </Text>
            <Text style={{ color: isMe ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' }} numberOfLines={1}>
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
