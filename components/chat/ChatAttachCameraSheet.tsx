/**
 * מצלמת צירוף לצ'אט — פריסת וואטסאפ: סגירה, פלאש, גלריה, תריס, היפוך.
 * מצבים: וידאו ותמונה. בלי פוטו נוט.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import MediaPreviewModal from './MediaPreviewModal';
import type { MediaFile } from '../../services/mediaService';

export type ChatAttachCameraResult = {
  uri: string;
  width?: number;
  height?: number;
  mediaType?: 'image' | 'video';
  durationMs?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: ChatAttachCameraResult) => void;
  /** שליחה מהפריביו שנפתח מיד אחרי הצילום, בלי לחזור לצ'אט. */
  onCommit?: (result: ChatAttachCameraResult, caption: string) => void | Promise<void>;
};

type CaptureMode = 'photo' | 'video';

const SCREEN_W = Dimensions.get('window').width;
const MODE_PILL_W = 78;
const MODE_PILL_GAP = 6;
const MODE_SPRING = { damping: 22, stiffness: 220, mass: 0.8 };
const RECORD_RED = '#FF3B30';

function shotToMediaFile(shot: ChatAttachCameraResult): MediaFile {
  const isVideo = shot.mediaType === 'video';
  return {
    id: `camera-${shot.uri}`,
    uri: shot.uri,
    type: isVideo ? 'video' : 'image',
    name: isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`,
    width: shot.width,
    height: shot.height,
    duration: shot.durationMs != null ? shot.durationMs / 1000 : undefined,
    thumbnail_url: shot.uri,
  };
}

export function ChatAttachCameraSheet({ visible, onClose, onCapture, onCommit }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashOn, setFlashOn] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const modeIndex = useSharedValue(0);
  const modeDragStart = useSharedValue(0);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  recordingRef.current = recording;
  const [shot, setShot] = useState<ChatAttachCameraResult | null>(null);
  const [suspendForGallery, setSuspendForGallery] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const recordStartedAt = useRef(0);
  const discardRecordingRef = useRef(false);
  const sentShotRef = useRef(false);

  const close = useCallback(() => {
    discardRecordingRef.current = true;
    if (recording) {
      cameraRef.current?.stopRecording();
    }
    void HapticFeedback.selection();
    onClose();
  }, [onClose, recording]);

  const flip = useCallback(() => {
    if (recording) return;
    void HapticFeedback.impactLight();
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, [recording]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permission?.granted) return true;
    const next = await requestPermission();
    if (!next.granted) {
      legacyAlert('אישור נדרש', 'אנא אשר גישה למצלמה');
      return false;
    }
    return true;
  }, [permission?.granted, requestPermission]);

  const ensureMic = useCallback(async (): Promise<boolean> => {
    if (micPermission?.granted) return true;
    const next = await requestMicPermission();
    if (!next.granted) {
      legacyAlert('אישור נדרש', 'אנא אשר גישה למיקרופון כדי להקליט וידאו');
      return false;
    }
    return true;
  }, [micPermission?.granted, requestMicPermission]);

  useEffect(() => {
    if (!visible) return;
    void ensurePermission();
  }, [ensurePermission, visible]);

  useEffect(() => {
    if (visible) {
      discardRecordingRef.current = false;
      sentShotRef.current = false;
      return;
    }
    setRecording(false);
    setCapturing(false);
    setCaptureMode('photo');
    modeIndex.value = 0;
    setShot(null);
    setSuspendForGallery(false);
  }, [modeIndex, visible]);

  const finish = useCallback((result: ChatAttachCameraResult) => {
    setShot(result);
  }, []);

  const takePhoto = useCallback(async () => {
    if (capturing || recording) return;
    const ok = await ensurePermission();
    if (!ok || !cameraRef.current) return;
    setCapturing(true);
    void HapticFeedback.impactMedium();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
        ...(Platform.OS === 'ios' ? { shutterSound: true } : {}),
      });
      if (!photo?.uri) return;
      finish({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        mediaType: 'image',
      });
    } catch {
      legacyAlert('שגיאה', 'לא הצלחנו לצלם תמונה');
    } finally {
      setCapturing(false);
    }
  }, [capturing, ensurePermission, finish, recording]);

  const stopRecording = useCallback(() => {
    cameraRef.current?.stopRecording();
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || capturing || !cameraRef.current) return;
    const camOk = await ensurePermission();
    const micOk = await ensureMic();
    if (!camOk || !micOk || !cameraRef.current) return;
    setRecording(true);
    recordStartedAt.current = Date.now();
    void HapticFeedback.impactMedium();
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (discardRecordingRef.current || !video?.uri) return;
      finish({
        uri: video.uri,
        mediaType: 'video',
        durationMs: Date.now() - recordStartedAt.current,
      });
    } catch {
      if (!discardRecordingRef.current) {
        legacyAlert('שגיאה', 'לא הצלחנו להקליט וידאו');
      }
    } finally {
      setRecording(false);
    }
  }, [capturing, ensureMic, ensurePermission, finish, recording]);

  const onShutter = useCallback(() => {
    if (captureMode === 'video') {
      if (recording) stopRecording();
      else void startRecording();
      return;
    }
    void takePhoto();
  }, [captureMode, recording, startRecording, stopRecording, takePhoto]);

  const openGallery = useCallback(async () => {
    if (recording || capturing) return;
    void HapticFeedback.selection();
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const next = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = next.status;
    }
    if (status !== 'granted') {
      legacyAlert('אישור נדרש', 'אנא אשר גישה לגלריה');
      return;
    }
    // בוחר התמונות של iOS לא נפתח מעל Modal במסך מלא.
    setSuspendForGallery(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      finish({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mediaType: isVideo ? 'video' : 'image',
        durationMs: isVideo && asset.duration ? asset.duration : undefined,
      });
    } catch {
      legacyAlert('שגיאה', 'לא הצלחנו לפתוח את הגלריה');
    } finally {
      setSuspendForGallery(false);
    }
  }, [capturing, finish, recording]);

  const commitMode = useCallback((idx: number) => {
    const mode: CaptureMode = idx <= 0 ? 'photo' : 'video';
    if (recordingRef.current) {
      if (mode !== 'photo') return;
      stopRecording();
    }
    setCaptureMode((current) => {
      if (current !== mode) void HapticFeedback.selection();
      return mode;
    });
  }, [stopRecording]);

  const switchMode = useCallback((mode: CaptureMode) => {
    if (recording && mode === 'video') return;
    if (recording && mode === 'photo') stopRecording();
    modeIndex.value = withSpring(mode === 'photo' ? 0 : 1, MODE_SPRING);
    if (captureMode !== mode) void HapticFeedback.selection();
    setCaptureMode(mode);
  }, [captureMode, modeIndex, recording, stopRecording]);

  const modeSwipe = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-28, 28])
    .failOffsetY([-18, 18])
    .enabled(!recording && !capturing)
    .onStart(() => {
      'worklet';
      modeDragStart.value = modeIndex.value;
    })
    .onUpdate((e) => {
      'worklet';
      const raw = modeDragStart.value + -e.translationX / SCREEN_W;
      modeIndex.value = Math.max(0, Math.min(1, raw));
    })
    .onEnd((e) => {
      'worklet';
      let target = Math.round(modeIndex.value);
      if (e.velocityX < -400) target = Math.min(1, Math.ceil(modeIndex.value));
      else if (e.velocityX > 400) target = Math.max(0, Math.floor(modeIndex.value));
      modeIndex.value = withSpring(target, MODE_SPRING);
      runOnJS(commitMode)(target);
    });

  const modeHighlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: modeIndex.value * (MODE_PILL_W + MODE_PILL_GAP) }],
  }));
  const photoLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeIndex.value, [0, 1], [1, 0.5]),
  }));
  const videoLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeIndex.value, [0, 1], [0.5, 1]),
  }));

  const previewFiles = useMemo(
    () => (shot ? [shotToMediaFile(shot)] : []),
    [shot],
  );

  if (!visible) return null;

  const granted = permission?.granted === true;

  return (
    <Modal
      visible={visible && !suspendForGallery}
      animationType={shot || suspendForGallery ? 'none' : 'slide'}
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (shot) setShot(null);
        else close();
      }}
    >
      <GestureHandlerRootView style={styles.root}>
        {shot ? (
          <MediaPreviewModal
            embedded
            visible
            mediaFiles={previewFiles}
            onClose={() => {
              if (sentShotRef.current) return;
              setShot(null);
            }}
            onSend={(_files, captions) => {
              const caption = Object.values(captions).find((line) => line.trim()) || '';
              sentShotRef.current = true;
              if (onCommit) void onCommit(shot, caption);
              else onCapture(shot);
              onClose();
            }}
          />
        ) : null}
        {shot ? null : (<>
        {granted ? (
          <GestureDetector gesture={modeSwipe}>
            <View style={StyleSheet.absoluteFill} collapsable={false}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                mode="video"
                flash={flashOn ? 'on' : 'off'}
                enableTorch={flashOn && facing === 'back'}
                animateShutter={false}
              />
            </View>
          </GestureDetector>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permissionFallback]}>
            <Ionicons name="camera-outline" size={56} color="rgba(255,255,255,0.45)" />
            <Text style={styles.permissionText}>נדרשת הרשאה למצלמה</Text>
            <Pressable
              onPress={() => void ensurePermission()}
              style={styles.permissionBtn}
              accessibilityRole="button"
              accessibilityLabel="אפשר גישה למצלמה"
            >
              <Text style={styles.permissionBtnLabel}>אפשר מצלמה</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          <Pressable
            onPress={close}
            style={styles.circleBtn}
            accessibilityRole="button"
            accessibilityLabel="סגור"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              void HapticFeedback.selection();
              setFlashOn((on) => !on);
            }}
            style={styles.circleBtn}
            accessibilityRole="button"
            accessibilityLabel={flashOn ? 'כבה פלאש' : 'הדלק פלאש'}
          >
            <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
          <View style={styles.controls}>
            <View style={styles.sideCluster}>
              <Pressable
                onPress={() => void openGallery()}
                style={styles.circleBtn}
                accessibilityRole="button"
                accessibilityLabel="גלריה"
              >
                <Ionicons name="images" size={22} color="#fff" />
              </Pressable>
            </View>

            <Pressable
              onPress={onShutter}
              disabled={!granted || capturing}
              style={({ pressed }) => [
                styles.shutterOuter,
                pressed && { opacity: 0.88 },
                (!granted || capturing) && { opacity: 0.45 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={captureMode === 'video' ? (recording ? 'עצור הקלטה' : 'הקלט וידאו') : 'צלם תמונה'}
            >
              {capturing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View
                  style={[
                    styles.shutterInner,
                    captureMode === 'video' && styles.shutterVideo,
                    recording && styles.shutterRecording,
                  ]}
                />
              )}
            </Pressable>

            <View style={[styles.sideCluster, styles.sideClusterEnd]}>
              <Pressable
                onPress={flip}
                style={styles.circleBtn}
                accessibilityRole="button"
                accessibilityLabel="החלף מצלמה"
              >
                <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.modeBar}>
            <View style={styles.modeTrack}>
              <Animated.View style={[styles.modeHighlight, modeHighlightStyle]} />
              <Pressable
                onPress={() => switchMode('photo')}
                style={styles.modePill}
                accessibilityRole="button"
                accessibilityState={{ selected: captureMode === 'photo' }}
                accessibilityLabel="תמונה"
              >
                <Animated.Text style={[styles.modeLabel, photoLabelStyle]}>תמונה</Animated.Text>
              </Pressable>
              <Pressable
                onPress={() => switchMode('video')}
                style={styles.modePill}
                accessibilityRole="button"
                accessibilityState={{ selected: captureMode === 'video' }}
                accessibilityLabel="וידאו"
              >
                <Animated.Text style={[styles.modeLabel, videoLabelStyle]}>וידאו</Animated.Text>
              </Pressable>
            </View>
          </View>
        </View>
        </>)}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    backgroundColor: '#000',
  },
  permissionText: {
    ...appPhysicalRightText,
    color: 'rgba(255,255,255,0.72)',
    fontSize: APP_TYPE.body.fontSize,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 8,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  permissionBtnLabel: {
    fontSize: APP_TYPE.body.fontSize,
    fontWeight: '600',
    color: '#111',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  controls: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  sideCluster: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sideClusterEnd: {
    justifyContent: 'flex-end',
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40,40,43,0.55)',
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
  },
  shutterVideo: {
    backgroundColor: RECORD_RED,
  },
  shutterRecording: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: RECORD_RED,
  },
  modeBar: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  modeTrack: {
    direction: 'ltr',
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    padding: 3,
    gap: MODE_PILL_GAP,
  },
  modeHighlight: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: MODE_PILL_W,
    height: 32,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  modePill: {
    width: MODE_PILL_W,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  modeLabel: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: '700',
    color: '#FFFFFF',
    writingDirection: 'rtl',
  },
});
