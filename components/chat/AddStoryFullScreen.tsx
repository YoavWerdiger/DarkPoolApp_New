import { StatusBar } from 'expo-status-bar';
import { ROOT_DIR, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Image, Dimensions, TextInput, KeyboardAvoidingView, Platform, ScrollView, FlatList, Animated, Keyboard } from 'react-native';
import { ActivityIndicator } from '../ui/AppSpinner';
import { enterCameraAudioSession, ensurePermissionOrSettings, exitCameraAudioSession , requestCameraWithDialog } from '../../lib/cameraSession';
import { publishStoryOptimistic } from '../../lib/pendingStories';
import { InlineAppDialog } from '../ui/InlineAppDialog';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { stableCameraPreviewFrame } from '../../lib/cameraFrame';
import { InAppGalleryPanel, type InAppGalleryPick } from './InAppGalleryPanel';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getGalleryPermission, requestGalleryPermission } from '../../utils/galleryPermission';
import {
  peekMediaRecents,
  prefetchMediaRecents,
  requestMediaLibraryRead,
  resolveMediaRecentLocalUri,
  type MediaRecentAsset,
} from '../../lib/mediaRecentsCache';
import { Audio, Video, ResizeMode } from '../../lib/expoAvSafe';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { uploadStoryImage, uploadStoryVideo, createStory } from '../../services/storiesService';
import { chatPalette } from './chatDesignTokens';
import { useCaptureCameraMode } from '../../hooks/useCaptureCameraMode';
import { ensureUgcTermsAccepted } from '../moderation/ugcTermsGate';
import type { TextInputInstance, ViewInstance } from 'react-native';
import { silent } from '../../utils/silentError';
import StaticDesignTokens from '../../components/ui/DesignTokens';
import {
  M,
  SW,
  SH,
  GALLERY_THUMB,
  CAPTURE_SIZE,
  CAPTURE_RING,
  PILL_W,
  PILL_GAP,
  CHROME_FILL,
  CHROME_LINE,
  persistRecordedStoryVideo,
  GRADIENT_BACKGROUNDS,
  DRAW_COLORS,
  DRAW_STROKE_WIDTHS,
  pickWideAngleLens,
  pickBestPictureSize,
  BgStyle,
  TextOverlayItem,
  DrawPath,
  DraggableText,
  TextEditorOverlay,
  EmojiPickerOverlay,
  DrawingCanvas,
  TrashZone,
  AddStoryFullScreenProps,
  ScreenMode,
  ScreenPhase,
} from './addStory/storyEditorParts';
import { s } from './addStory/addStoryStyles';
import { blackAlpha, whiteAlpha } from '../../components/ui/designTokensStatic';

export default function AddStoryFullScreen({ visible, onClose, onAdded, presentation = 'modal' }: AddStoryFullScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ScreenMode>('camera');
  const [phase, setPhase] = useState<ScreenPhase>('capture');
  const cameraFrame = stableCameraPreviewFrame();
  const tokens = useDesignTokens();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const capturingRef = useRef(false);
  /** 0–1, controlled pinch zoom (CameraView has no built-in pinch) */
  const [cameraZoom, setCameraZoom] = useState(0);
  /** iOS: שם עדשה מקומי (לא deviceType) — בוחרים wide 1x ולא ultrawide 0.5x */
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  /** Mount the player only after the camera session has released the file and audio route. */
  const [videoSurfaceReady, setVideoSurfaceReady] = useState(false);
  /** Player view must have a real frame before AVPlayerLayer will draw (audio can start at 0×0). */
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textBgIndex, setTextBgIndex] = useState(0);
  const [recentPhotos, setRecentPhotos] = useState<MediaRecentAsset[]>(
    () => peekMediaRecents('all')?.assets ?? [],
  );
  const [galleryExpanded, setGalleryExpanded] = useState(false);

  const textInputRef = useRef<TextInputInstance>(null);
  const cameraRef = useRef<CameraView>(null);
  // Android: במצב 'video' אין צילום תמונה — 'picture' כברירת מחדל, 'video' רק להקלטה
  const camMode = useCaptureCameraMode();
  const recordTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [overlays, setOverlays] = useState<TextOverlayItem[]>([]);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const captureAreaRef = useRef<ViewInstance>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [drawStrokeWidth, setDrawStrokeWidth] = useState<number>(DRAW_STROKE_WIDTHS[1]);

  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);
  const [trashHover, setTrashHover] = useState(false);

  const gallerySlide = useRef(new Animated.Value(0)).current;

  const MODES: ScreenMode[] = ['camera', 'text'];
  const modeIndex = useSharedValue(0);
  const dragStartIndex = useSharedValue(0);

  const SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8 };

  const switchMode = useCallback((target: ScreenMode) => {
    const idx = MODES.indexOf(target);
    modeIndex.value = withSpring(idx, SPRING_CONFIG);
    setMode(target);
  }, []);

  const logPanEvent = useCallback((name: string, phase: 'begin' | 'end') => {
    logger.debug('AddStoryFullScreen', `pan ${name} ${phase} (platform=${Platform.OS})`);
  }, []);

  /*
   * Mode-switch swipe — horizontal only, 1 finger.
   * Stricter offsets so light vertical pulls don't steal / fight dismiss.
   * Attached ONLY to the camera/text background strip; chrome controls are siblings.
   */
  const swipeGesture = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetX([-28, 28])
    .failOffsetY([-18, 18])
    .onStart(() => {
      'worklet';
      dragStartIndex.value = modeIndex.value;
      runOnJS(logPanEvent)('swipe', 'begin');
    })
    .onUpdate((e) => {
      'worklet';
      const dragProgress = -e.translationX / SW;
      const raw = dragStartIndex.value + dragProgress;
      modeIndex.value = Math.max(0, Math.min(MODES.length - 1, raw));
    })
    .onEnd((e) => {
      'worklet';
      const velocityThreshold = 400;
      let targetIdx: number;

      if (e.velocityX < -velocityThreshold) {
        targetIdx = Math.min(MODES.length - 1, Math.ceil(modeIndex.value));
      } else if (e.velocityX > velocityThreshold) {
        targetIdx = Math.max(0, Math.floor(modeIndex.value));
      } else {
        targetIdx = Math.round(modeIndex.value);
      }

      modeIndex.value = withSpring(targetIdx, SPRING_CONFIG);
      runOnJS(setMode)(MODES[targetIdx]);
      runOnJS(logPanEvent)('swipe', 'end');
    });

  const stripAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -modeIndex.value * SW }],
  }));

  /* ── Swipe-down-to-close (tight Instagram/WhatsApp-like thresholds) ── */
  const dismissY = useSharedValue(0);
  /** Need a clear intentional drag — low values made light pulls "escape". */
  const DISMISS_ACTIVE_Y = 64;
  const DISMISS_THRESHOLD = Math.min(SH * 0.32, 260);
  const DISMISS_VELOCITY = 1600;

  const triggerCloseHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(silent('AddStoryFullScreen'));
  };

  const handleDismissClose = useCallback(() => {
    cancelAnimation(dismissY);
    dismissY.value = 0;
    Keyboard.dismiss();
    triggerCloseHaptic();
    onClose();
  }, [onClose]);

  // Disable dismiss while: uploading, drawing, recording, capturing, dragging overlays, gallery, or modals
  const dismissDisabled =
    phase === 'uploading' ||
    drawMode ||
    isRecording ||
    isCapturing ||
    galleryExpanded ||
    !!draggingOverlayId ||
    showTextEditor ||
    showEmojiPicker;

  /*
   * Swipe-down dismiss — 1 finger, vertical-only, fails fast on horizontal.
   * Must NOT wrap shutter / gallery / mode pills (Android Pan steals their touches).
   */
  const dismissGesture = Gesture.Pan()
    .maxPointers(1)
    .activeOffsetY([DISMISS_ACTIVE_Y, 9999])
    .failOffsetX([-16, 16])
    .enabled(!dismissDisabled)
    .onStart(() => {
      'worklet';
      runOnJS(logPanEvent)('dismiss', 'begin');
    })
    .onUpdate((e) => {
      'worklet';
      // Rubber-band until past threshold so accidental drags barely move the UI
      if (e.translationY <= 0) {
        dismissY.value = e.translationY * 0.1;
        return;
      }
      const drag = e.translationY;
      dismissY.value =
        drag < DISMISS_THRESHOLD
          ? drag * 0.42
          : DISMISS_THRESHOLD * 0.42 + (drag - DISMISS_THRESHOLD) * 0.92;
    })
    .onEnd((e) => {
      'worklet';
      // Decide on raw finger travel/velocity, not the dampened visual offset
      const shouldClose =
        e.translationY > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY;
      if (shouldClose) {
        runOnJS(handleDismissClose)();
      } else {
        dismissY.value = withSpring(0, { damping: 24, stiffness: 260, mass: 0.55 });
      }
      runOnJS(logPanEvent)('dismiss', 'end');
    });

  /* Pinch-to-zoom — throttle React zoom prop; per-frame setState freezes CameraView. */
  const zoomSV = useSharedValue(0);
  const pinchStartZoom = useSharedValue(0);
  const zoomCommitAt = useSharedValue(0);
  useEffect(() => {
    zoomSV.value = cameraZoom;
  }, [cameraZoom]);

  const applyCameraZoom = useCallback((z: number) => {
    setCameraZoom(z);
  }, []);

  const pinchGesture = Gesture.Pinch()
    .enabled(mode === 'camera' && phase === 'capture' && !dismissDisabled)
    .onBegin(() => {
      'worklet';
      pinchStartZoom.value = zoomSV.value;
      zoomCommitAt.value = 0;
      runOnJS(logPanEvent)('pinch', 'begin');
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.min(1, Math.max(0, pinchStartZoom.value + (e.scale - 1) * 0.55));
      zoomSV.value = next;
      const now = Date.now();
      if (now - zoomCommitAt.value >= 50) {
        zoomCommitAt.value = now;
        runOnJS(applyCameraZoom)(next);
      }
    })
    .onEnd(() => {
      'worklet';
      runOnJS(applyCameraZoom)(zoomSV.value);
      runOnJS(logPanEvent)('pinch', 'end');
    });

  /*
   * Pinch runs Simultaneous with axis-gated pans (maxPointers(1) on pans).
   * Race(dismiss, swipe) so vertical vs horizontal don't both win.
   * Avoid Exclusive(pinch, …) — it can delay 1-finger pans waiting for a 2nd finger.
   */
  const captureBackgroundGestures = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(dismissGesture, swipeGesture),
  );

  /** Preview-phase dismiss only (no mode swipe / pinch). */
  const previewDismissGesture = dismissGesture;

  // Translate only — opacity on a live CameraView is a major compositing jank source
  const dismissAnimStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: Math.max(0, dismissY.value) }],
    };
  });


  const indicatorAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: modeIndex.value * (PILL_W + PILL_GAP) }],
  }));
  const cameraPillOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(modeIndex.value, [0, 1], [1, 0.5]),
  }));
  const textPillOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(modeIndex.value, [0, 1], [0.5, 1]),
  }));

  useEffect(() => {
    if (!visible) {
      setPhase('capture');
      setMode('camera');
      modeIndex.value = 0;
      cancelAnimation(dismissY);
      dismissY.value = 0;
      setMediaUri(null);
      setMediaType('image');
      setVideoSurfaceReady(false);
      setVideoFrameReady(false);
      setVideoAttempt(0);
      setIsUploading(false);
      setTextContent('');
      setTextBgIndex(0);
      setOverlays([]);
      setShowTextEditor(false);
      setEditingOverlayId(null);
      setIsRecording(false);
      capturingRef.current = false;
      setIsCapturing(false);
      setCameraZoom(0);
      zoomSV.value = 0;
      setGalleryExpanded(false);
      setShowEmojiPicker(false);
      setDrawPaths([]);
      setDrawMode(false);
      setDrawColor(DRAW_COLORS[0]);
      setDrawStrokeWidth(DRAW_STROKE_WIDTHS[1]);
      setDraggingOverlayId(null);
      setTrashHover(false);
      Keyboard.dismiss();
    } else {
      cancelAnimation(dismissY);
      dismissY.value = 0;
      capturingRef.current = false;
      setIsCapturing(false);
      setCameraZoom(0);
      zoomSV.value = 0;
      loadRecentPhotos();
    }
  }, [visible]);

  // בקשת הרשאת מצלמה — רק אחרי שמצב ההרשאה נטען (permission === null בזמן טעינה, ואז הדיאלוג
  // הופיע בכל כניסה גם כשכבר אושר), ופעם אחת לכל פתיחה
  const askedCameraRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      askedCameraRef.current = false;
      return;
    }
    if (!permission || permission.granted || askedCameraRef.current) return;
    askedCameraRef.current = true;
    void requestCameraWithDialog(permission, requestPermission);
  }, [visible, permission, requestPermission]);

  // סשן אודיו שמאפשר הקלטה לפני שמרכיבים את המצלמה (בכל כניסה לצילום — גם אחרי פריוויו
  // של וידאו שמחזיר ל«ניגון בלבד»); אחרת התצוגה נתקעת על הפריים הראשון
  const [cameraSessionReady, setCameraSessionReady] = useState(false);
  useEffect(() => {
    if (!visible || phase !== 'capture') {
      setCameraSessionReady(false);
      return;
    }
    let cancelled = false;
    void enterCameraAudioSession().then(() => {
      if (!cancelled) setCameraSessionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, phase]);
  useEffect(() => {
    if (!visible) void exitCameraAudioSession();
    // במצב מסך (AddStory) visible תמיד true — משחררים את סשן המצלמה/אודיו גם ביציאה מהמסך
    return () => {
      void exitCameraAudioSession();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || phase !== 'preview' || mediaType !== 'video' || !mediaUri) {
      setVideoSurfaceReady(false);
      setVideoFrameReady(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });
        } catch (err) {
          logger.warn('AddStoryFullScreen', 'playback audio mode failed', err);
        }
        if (!cancelled) setVideoSurfaceReady(true);
      })();
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, phase, mediaType, mediaUri, videoAttempt]);

  // מעבר מצב (כפתור או החלקה): לטקסט — פוקוס; למצלמה — המקלדת יורדת.
  // הטיימר מתבטל במעבר מהיר חזרה, כדי שפוקוס מאוחר לא יפתח שוב את המקלדת מעל המצלמה
  useEffect(() => {
    if (mode === 'text') {
      const t = setTimeout(() => textInputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
    textInputRef.current?.blur();
    Keyboard.dismiss();
    return undefined;
  }, [mode]);

  useEffect(() => {
    Animated.spring(gallerySlide, {
      toValue: galleryExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 12,
      tension: 60,
    }).start();
  }, [galleryExpanded]);

  const loadRecentPhotos = async () => {
    const cached = peekMediaRecents('all');
    if (cached) setRecentPhotos(cached.assets);
    try {
      const page = await prefetchMediaRecents('all');
      if (page) setRecentPhotos(page.assets);
    } catch (error) {
      logger.error('AddStoryFullScreen', 'Failed to load recent photos', error);
    }
  };

  const selectRecentPhoto = async (asset: MediaRecentAsset) => {
    try {
      const isVideo = asset.mediaType === 'video';
      const uri = await resolveMediaRecentLocalUri(asset.id, asset.uri, { downloadFromNetwork: isVideo, isVideo });
      if (!uri || uri.startsWith('ph://')) {
        openGallery();
        return;
      }
      setMediaUri(uri);
      setMediaType(asset.mediaType === 'video' ? 'video' : 'image');
      setOverlays([]);
      setGalleryExpanded(false);
      setPhase('preview');
    } catch {
      openGallery();
    }
  };

  const configureCamera = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      if (Platform.OS === 'ios' && typeof cam.getAvailableLensesAsync === 'function') {
        const lenses = await cam.getAvailableLensesAsync();
        const wide = pickWideAngleLens(lenses);
        if (wide) setSelectedLens(wide);
      }
      if (typeof cam.getAvailablePictureSizesAsync === 'function') {
        const sizes = await cam.getAvailablePictureSizesAsync();
        const best = pickBestPictureSize(sizes);
        if (best) setPictureSize((prev) => (prev === best ? prev : best));
      }
    } catch (err) {
      logger.warn('AddStoryFullScreen', 'Camera configure failed', err);
    }
  }, []);

  const takePicture = useCallback(async () => {
    logger.debug(
      'AddStoryFullScreen',
      `takePicture invoked (platform=${Platform.OS}, hasRef=${!!cameraRef.current}, isRecording=${isRecording}, isCapturing=${capturingRef.current})`,
    );
    if (capturingRef.current || isRecording) {
      logger.warn('AddStoryFullScreen', 'takePicture bailed: busy');
      return;
    }
    if (!cameraRef.current) {
      // On Android the ref can briefly be null between mode switches / permission
      // grants; log so we can see this in production instead of silently no-op-ing.
      logger.warn('AddStoryFullScreen', 'takePicture bailed: cameraRef.current is null');
      return;
    }
    capturingRef.current = true;
    setIsCapturing(true);
    try {
      await camMode.ensurePictureMode();
      if (!cameraRef.current) return;
      logger.debug('AddStoryFullScreen', 'takePictureAsync start');
      // `shutterSound` is iOS-only in expo-camera; passing it on Android does
      // nothing but keeping it iOS-scoped avoids any device-specific rejection.
      const photo = await cameraRef.current.takePictureAsync({
        // 0.82 is visually fine for stories and much faster than quality:1 / 4K buffers
        quality: 0.82,
        ...(Platform.OS === 'ios' ? { shutterSound: true } : {}),
      });
      logger.debug('AddStoryFullScreen', `takePictureAsync end: uri=${photo?.uri ?? 'null'}`);
      if (photo?.uri) {
        setMediaUri(photo.uri);
        setMediaType('image');
        setOverlays([]);
        setPhase('preview');
      } else {
        legacyAlert(i18n.t('auto.components__chat__AddStoryFullScreen.s6'), i18n.t('auto.components__chat__AddStoryFullScreen.s7'));
      }
    } catch (err: any) {
      logger.error('AddStoryFullScreen', 'Take picture failed', err);
      legacyAlert(i18n.t('auto.components__chat__AddStoryFullScreen.s6'), i18n.t('auto.components__chat__AddStoryFullScreen.s7'));
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
      logger.debug('AddStoryFullScreen', 'takePicture finally — isCapturing reset');
    }
  }, [camMode, isRecording]);

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    cameraRef.current?.stopRecording?.();
  }, []);

  const startRecording = useCallback(async () => {
    logger.debug(
      'AddStoryFullScreen',
      `startRecording invoked (platform=${Platform.OS}, hasRef=${!!cameraRef.current})`,
    );
    if (!cameraRef.current) {
      logger.warn('AddStoryFullScreen', 'startRecording bailed: cameraRef.current is null');
      return;
    }
    try {
      setIsRecording(true);
      await camMode.ensureVideoMode();
      if (!cameraRef.current) return;
      recordTimerRef.current = setTimeout(() => {
        stopRecording();
      }, 30000);
      const video = await cameraRef.current.recordAsync?.({ maxDuration: 30 });
      if (video?.uri) {
        const uri = await persistRecordedStoryVideo(video.uri);
        setVideoAttempt(0);
        setMediaUri(uri);
        setMediaType('video');
        setOverlays([]);
        setPhase('preview');
      }
    } catch (err: any) {
      logger.error('AddStoryFullScreen', 'Recording failed', err);
      legacyAlert(i18n.t('auto.components__chat__AddStoryFullScreen.s6'), err?.message || i18n.t('auto.components__chat__AddStoryFullScreen.s8'));
    } finally {
      setIsRecording(false);
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    }
  }, [camMode, stopRecording]);

  const openGallery = useCallback(async () => {
    logger.debug('AddStoryFullScreen', `openGallery start (platform=${Platform.OS}, user=${!!user?.id})`);
    if (!user?.id) {
      logger.warn('AddStoryFullScreen', 'openGallery bailed: no user');
      return;
    }
    try {
      // אנדרואיד: Photo Picker של המערכת לא צריך הרשאה (ואין לנו READ_MEDIA_* במניפסט)
      if (Platform.OS !== 'android') {
        const perm = await requestGalleryPermission();
        const status = perm.status;
        logger.debug('AddStoryFullScreen', `openGallery permission=${status} access=${perm.accessPrivileges ?? '-'}`);
        // «גישה מוגבלת» (iOS: רק תמונות נבחרות) — גם היא אישור; קודם נחשבה סירוב והבקשה חזרה
        if (status !== 'granted' && perm.accessPrivileges !== 'limited') {
          legacyAlert(i18n.t('auto.components__chat__AddStoryFullScreen.s9'), i18n.t('auto.components__chat__AddStoryFullScreen.s10'));
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
        videoMaxDuration: 30,
      });
      logger.debug(
        'AddStoryFullScreen',
        `openGallery picker done canceled=${result.canceled} assets=${result.assets?.length ?? 0}`,
      );
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || ('duration' in asset && (asset as any).duration > 0);
      setMediaUri(asset.uri);
      setMediaType(isVideo ? 'video' : 'image');
      setOverlays([]);
      setGalleryExpanded(false);
      setPhase('preview');
    } catch (err) {
      logger.error('AddStoryFullScreen', 'openGallery failed', err);
      legacyAlert(i18n.t('auto.components__chat__AddStoryFullScreen.s6'), i18n.t('auto.components__chat__AddStoryFullScreen.s11'));
    }
  }, [user?.id]);

  // אותה גלריה כמו במצלמת הצ'אט — בתוך המסך
  const [inAppGalleryOpen, setInAppGalleryOpen] = useState(false);
  const onInAppGalleryPick = useCallback((pick: InAppGalleryPick) => {
    setInAppGalleryOpen(false);
    setMediaUri(pick.uri);
    setMediaType(pick.mediaType);
    setOverlays([]);
    setGalleryExpanded(false);
    setPhase('preview');
  }, []);

  const handleGalleryPress = useCallback(() => {
    void HapticFeedback.selection();
    if (Platform.OS === 'android') {
      void openGallery();
      return;
    }
    setInAppGalleryOpen(true);
  }, [openGallery]);


  const handleCapturePress = useCallback(() => {
    logger.debug('AddStoryFullScreen', `capture press / shutter tap (platform=${Platform.OS})`);
    // בלי הרשאה — הדיאלוג שוב (במקום כפתור «אפשר מצלמה»)
    if (!permission?.granted) {
      void requestCameraWithDialog(permission, requestPermission);
      return;
    }
    takePicture();
  }, [takePicture, permission, requestPermission]);

  const handleCaptureLongPress = useCallback(() => {
    logger.debug('AddStoryFullScreen', `capture long-press → record (platform=${Platform.OS})`);
    startRecording();
  }, [startRecording]);

  const handleCapturePressOut = useCallback(() => {
    if (isRecording) {
      logger.debug('AddStoryFullScreen', 'capture pressOut → stopRecording');
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const openTextEditor = useCallback((overlayId?: string) => {
    setEditingOverlayId(overlayId || null);
    setShowTextEditor(true);
  }, []);

  const handleTextEditorDone = useCallback((
    text: string, color: string, fontSize: number, bold: boolean, bgStyle: BgStyle,
  ) => {
    if (editingOverlayId) {
      setOverlays(prev => prev.map(o =>
        o.id === editingOverlayId
          ? { ...o, text, color, fontSize, bold, bgStyle }
          : o
      ));
    } else {
      const newOverlay: TextOverlayItem = {
        id: Date.now().toString(),
        type: 'text',
        text,
        color,
        fontSize,
        bold,
        bgStyle,
        x: 0,
        y: 0,
        scale: 1,
      };
      setOverlays(prev => [...prev, newOverlay]);
    }
    setShowTextEditor(false);
    setEditingOverlayId(null);
  }, [editingOverlayId]);

  const handleAddEmoji = useCallback((emoji: string) => {
    const newOverlay: TextOverlayItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'emoji',
      text: emoji,
      color: M.text,
      fontSize: 72,
      bold: false,
      bgStyle: 'none',
      x: 0,
      y: 0,
      scale: 1,
    };
    setOverlays(prev => [...prev, newOverlay]);
    setShowEmojiPicker(false);
  }, []);

  const handleOverlayDragChange = useCallback((id: string, dragging: boolean, absY: number, hovering: boolean) => {
    if (dragging) {
      setDraggingOverlayId(id);
      setTrashHover(hovering);
    } else {
      setDraggingOverlayId(null);
      setTrashHover(false);
    }
  }, []);

  const handleOverlayDelete = useCallback((id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
    setDraggingOverlayId(null);
    setTrashHover(false);
  }, []);

  const handleOverlayCommitPosition = useCallback((id: string, x: number, y: number, scale: number) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, x, y, scale } : o));
  }, []);

  const undoLastDraw = useCallback(() => {
    setDrawPaths(prev => prev.slice(0, -1));
  }, []);

  const clearDrawing = useCallback(() => {
    setDrawPaths([]);
  }, []);

  const handleShareMedia = async () => {
    if (!(await ensureUgcTermsAccepted())) return;
    if (!user?.id || !mediaUri) return;
    try {
      const hasOverlays = overlays.length > 0;
      const hasDrawings = drawPaths.length > 0;
      logger.debug(
        'AddStoryFullScreen',
        `Starting upload: type=${mediaType}, overlays=${overlays.length}, drawings=${drawPaths.length}`,
      );

      // Always send overlays/drawings as JSON alongside the raw media.
      // The viewer re-renders them on top at view time. This is reliable across
      // image/video, Reanimated, SVG, RN new architecture and older devices.
      const overlayContent: string | undefined = (hasOverlays || hasDrawings)
        ? JSON.stringify({
            v: 2,
            canvasWidth: SW,
            canvasHeight: cameraFrame.height,
            overlays: overlays.map(o => ({
              type: o.type || 'text',
              text: o.text,
              color: o.color,
              fontSize: o.fontSize,
              bold: o.bold,
              bgStyle: o.bgStyle,
              x: o.x,
              y: o.y,
              scale: o.scale,
            })),
            drawings: drawPaths.map(p => ({
              d: p.d,
              color: p.color,
              strokeWidth: p.strokeWidth,
            })),
          })
        : undefined;

      // אופטימי: המסך נסגר מיד, הסטורי מופיע בשורה עם «עולה», וההעלאה רצה ברקע
      publishStoryOptimistic({
        userId: user.id,
        mediaType,
        localUri: mediaUri,
        content: overlayContent,
      });
      void HapticFeedback.success();
      closeAfterTouch();
    } catch (e: any) {
      logger.error('AddStoryFullScreen', 'Share failed', e);
      legacyAlert(i18n.t('auto.components__chat__AddStoryFullScreen.s6'), e?.message || i18n.t('auto.components__chat__AddStoryFullScreen.s12'));
    }
  };

  /** סגירה אחרי שרצף הנגיעה של «שתף» הסתיים (שני פריימים) — לא להסיר את המסך באמצע עיבוד המחווה */
  const closeAfterTouch = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => onClose()));
  };

  const handleShareText = async () => {
    if (!user?.id || !textContent.trim()) return;
    if (!(await ensureUgcTermsAccepted())) return;
    const bg = GRADIENT_BACKGROUNDS[textBgIndex];
    publishStoryOptimistic({
      userId: user.id,
      mediaType: 'text',
      localUri: null,
      content: textContent.trim(),
      backgroundColor: bg[0],
    });
    void HapticFeedback.success();
    closeAfterTouch();
  };

  const editingOverlay = editingOverlayId
    ? overlays.find(o => o.id === editingOverlayId) || null
    : null;

  if (!visible) return null;

  const galleryHeight = gallerySlide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SH * 0.4],
  });

  /* ═══════════════════════════════════════════════ */
  /* ═══════ CAMERA / CAPTURE PHASE ═══════════════ */
  /* ═══════════════════════════════════════════════ */
  /*
   * Capture phase layout (Android-critical):
   * 1) Simultaneous(dismiss, swipe, pinch) only on the camera preview panel.
   * 2) Camera / text chrome as ABSOLUTE SIBLINGS outside Pan so
   *    TouchableOpacity / Pressable receive taps (nested Pan was freezing UI).
   */
  const renderCapturePhase = () => (
    <View style={s.fullFlex}>
      {/*
        Strip is animated, but Pan/Pinch attach ONLY to the camera panel.
        Text panel stays free so TextInput / color chips aren't under a greedy Pan.
      */}
      <Reanimated.View style={[s.modeStrip, stripAnimStyle]}>
        {/* ── Panel 0: Camera preview + background gestures ── */}
        <View style={s.modePanel} collapsable={false}>
          <GestureDetector gesture={captureBackgroundGestures}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: M.base }]} collapsable={false}>
              {permission?.granted && cameraSessionReady ? (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  // iOS: תמיד 'video' (גם תמונה עובדת, בלי קפיצה בהקלטה).
                  // Android: ב-'video' ImageCapture לא מחובר ו-takePictureAsync נכשל תמיד —
                  // 'picture' כברירת מחדל ו-'video' רק לפני הקלטה (useCaptureCameraMode).
                  mode={camMode.mode}
                  flash={flash ? 'on' : 'off'}
                  zoom={cameraZoom}
                  videoQuality="1080p"
                  animateShutter={false}
                  {...(pictureSize ? { pictureSize } : {})}
                  {...(selectedLens ? { selectedLens } : {})}
                  onCameraReady={() => {
                    logger.debug('AddStoryFullScreen', 'camera ready');
                    camMode.notifyCameraReady();
                    void configureCamera();
                  }}
                  onMountError={(e) => logger.error('AddStoryFullScreen', 'camera mount error', e?.message)}
                  onAvailableLensesChanged={({ lenses }) => {
                    let wide: string | undefined;
                    try {
                      wide = pickWideAngleLens(lenses ?? []);
                    } catch {
                      return;
                    }
                    if (wide) setSelectedLens((prev) => (prev === wide ? prev : wide));
                  }}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: M.base, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="camera-outline" size={64} color={whiteAlpha(0.2)} />
                </View>
              )}

              <LinearGradient
                colors={[StaticDesignTokens.colors.onMedia.scrimMedium, 'transparent']}
                style={s.vignetteTop}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', blackAlpha(0.65)]}
                style={s.vignetteBottom}
                pointerEvents="none"
              />
              {/* «חלון» כמו בצ'אט — המצלמה במסך מלא (מיכל בגודל מותאם הקפיא את התצוגה ב-iOS)
                  ופסים שחורים מעליו ומתחתיו */}
              <View pointerEvents="none" style={[s.cameraMask, { top: 0, height: cameraFrame.top }]} />
              <View
                pointerEvents="none"
                style={[s.cameraMask, { top: cameraFrame.top + cameraFrame.height, bottom: 0 }]}
              />
            </View>
          </GestureDetector>
        </View>

        {/* ── Panel 1: Text content (no Pan wrapper) ── */}
        <View style={s.modePanel}>
          <KeyboardAvoidingView
            style={s.fullFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <LinearGradient
              colors={GRADIENT_BACKGROUNDS[textBgIndex]}
              style={s.fullFlex}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => Keyboard.dismiss()}
                accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s13')}
              />
              <View style={{ height: insets.top + 60 }} pointerEvents="none" />

              <View style={s.textInputArea} pointerEvents="box-none">
                <TextInput
                  ref={textInputRef}
                  style={s.textBigInput}
                  placeholder={i18n.t('auto.components__chat__AddStoryFullScreen.s14')}
                  placeholderTextColor={whiteAlpha(0.45)}
                  value={textContent}
                  onChangeText={setTextContent}
                  multiline
                  maxLength={250}
                  textAlign="center"
                />
                <Text style={s.textCounter} pointerEvents="none">{textContent.length}/250</Text>
              </View>

              <View style={[s.textBgPicker, { paddingBottom: insets.bottom + 52 }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.textBgScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {GRADIENT_BACKGROUNDS.map((bg, idx) => (
                    <TouchableOpacity key={idx} onPress={() => setTextBgIndex(idx)} activeOpacity={0.7}>
                      <LinearGradient
                        colors={bg}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                          s.bgDot,
                          textBgIndex === idx && s.bgDotActive,
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </LinearGradient>
          </KeyboardAvoidingView>
        </View>
      </Reanimated.View>

      {/* ══ Camera chrome — OUTSIDE Pan (siblings, higher zIndex/elevation) ══ */}
      {mode === 'camera' && (
        <>
          <View
            style={[s.cameraTopBar, s.chromeLayer, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={s.topIconBtn}
              onPress={() => {
                logger.debug('AddStoryFullScreen', 'close press (camera chrome)');
                onClose();
              }}
            >
              <Ionicons name="close" size={28} color={M.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {!permission?.granted ? (
              // בלי הרשאה — בלי כפתור «אפשר מצלמה»; הבקשה בדיאלוג לפי הטופו
              <View style={s.topIconBtn} />
            ) : (
              <TouchableOpacity
                style={s.topIconBtn}
                onPress={() => setFlash(!flash)}
              >
                <Ionicons name={flash ? 'flash' : 'flash-off'} size={22} color={M.text} />
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[s.cameraBottom, s.chromeLayer, { paddingBottom: insets.bottom + 52 }]}
            pointerEvents="box-none"
          >
            <Animated.View style={[s.galleryExpanded, { height: galleryHeight, overflow: 'hidden' }]}>
              {galleryExpanded && (
                <FlatList
                  data={recentPhotos}
                  numColumns={3}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.galleryGrid}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={s.galleryGridItem}
                      onPress={() => selectRecentPhoto(item)}
                      activeOpacity={0.7}
                    >
                      <ExpoImage source={{ uri: item.uri }} style={s.galleryGridImg} />
                      {item.mediaType === 'video' && (
                        <View style={s.gridVideoTag}>
                          <Ionicons name="play" size={10} color={M.text} />
                          <Text style={s.gridVideoDuration}>
                            {Math.round((item.duration || 0))}s
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </Animated.View>

            <View style={s.captureRow} pointerEvents="box-none">
              <TouchableOpacity
                style={s.galleryBtn}
                onPress={handleGalleryPress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s15')}
              >
                {recentPhotos.length > 0 ? (
                  <ExpoImage source={{ uri: recentPhotos[0].uri }} style={s.galleryBtnImg} />
                ) : (
                  <Ionicons name="images" size={24} color={M.text} />
                )}
              </TouchableOpacity>

              {/*
                Pressable (not nested under Pan). Tap = photo, long-press = video.
                Outside Pan detectors so Android responder isn't stolen.
              */}
              <Pressable
                style={s.captureOuter}
                onPress={handleCapturePress}
                onLongPress={handleCaptureLongPress}
                onPressOut={handleCapturePressOut}
                delayLongPress={320}
                disabled={isCapturing}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessible
                accessibilityRole="button"
                accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s16')}
              >
                <View style={[
                  s.captureInner,
                  isRecording && s.captureRecording,
                  isCapturing && { opacity: 0.7 },
                ]} />
              </Pressable>

              <TouchableOpacity
                style={s.flipBtn}
                onPress={() => {
                  logger.debug('AddStoryFullScreen', 'flip camera press');
                  setSelectedLens(undefined);
                  setPictureSize(undefined);
                  setCameraZoom(0);
                  zoomSV.value = 0;
                  setFacing((f) => (f === 'back' ? 'front' : 'back'));
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-reverse-outline" size={26} color={M.text} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ══ Text chrome — OUTSIDE Pan ══ */}
      {mode === 'text' && (
        <View
          style={[s.cameraTopBar, s.chromeLayer, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={s.topIconBtn}
            onPress={() => {
              logger.debug('AddStoryFullScreen', 'close press (text chrome)');
              onClose();
            }}
          >
            <Ionicons name="close" size={28} color={M.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[s.sendChevronBtn, (!textContent.trim() || isUploading) && { opacity: 0.4 }]}
            onPress={handleShareText}
            disabled={!textContent.trim() || isUploading}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s17')}
          >
            <Ionicons name="arrow-up" size={26} color={M.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  /* ═══════════════════════════════════════════════ */
  /* ═══════ PREVIEW PHASE ════════════════════════ */
  /* ═══════════════════════════════════════════════ */
  const renderPreview = () => (
    <View style={[s.fullFlex, { backgroundColor: M.base }]}>
      {/* רקע: אותה תמונה מטושטשת ומוכהה מסביב לחלון (כמו וואטסאפ/אינסטגרם) */}
      {mediaType === 'image' && mediaUri ? (
        <>
          <ExpoImage
            source={{ uri: mediaUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={40}
            transition={0}
            pointerEvents="none"
          />
          <View style={[StyleSheet.absoluteFill, s.previewBlurDim]} pointerEvents="none" />
        </>
      ) : null}
      {/*
        Dismiss Pan wraps ONLY the media stack. Toolbars / share FAB are siblings
        so Android taps aren't stolen by the outer dismiss gesture.
      */}
      <GestureDetector gesture={previewDismissGesture}>
        <View
          ref={captureAreaRef}
          // אותו חלון כמו המצלמה (cameraPreviewFrame) — לא מסך מלא
          style={[s.previewFrame, { top: cameraFrame.top, height: cameraFrame.height }]}
          collapsable={false}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {mediaType === 'image' ? (
              // expo-image (מוקטן לגודל התצוגה): Image של RN מפענח את התמונה המלאה (~24MP) — החלון נשאר שחור
              <ExpoImage source={{ uri: mediaUri! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
            ) : videoSurfaceReady ? (
              <View
                pointerEvents="none"
                collapsable={false}
                style={[s.recordedVideo, { height: cameraFrame.height }]}
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  if (width > 0 && height > 0) setVideoFrameReady(true);
                }}
              >
                {videoFrameReady ? (
                  <Video
                    key={`${mediaUri}-${videoAttempt}`}
                    pointerEvents="none"
                    source={{ uri: mediaUri! }}
                    style={[s.recordedVideoFill, { height: cameraFrame.height }]}
                    useNativeControls={false}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping
                    onError={() => {
                      if (videoAttempt >= 1) return;
                      setVideoFrameReady(false);
                      setVideoSurfaceReady(false);
                      setVideoAttempt((n) => n + 1);
                    }}
                  />
                ) : null}
              </View>
            ) : (
              <View style={[StyleSheet.absoluteFill, s.videoWait]}>
                <ActivityIndicator color={M.text} />
              </View>
            )}
          </View>

          <DrawingCanvas
            paths={drawPaths}
            color={drawColor}
            strokeWidth={drawStrokeWidth}
            onPathComplete={(p) => setDrawPaths(prev => [...prev, p])}
            enabled={drawMode}
          />

        </View>
      </GestureDetector>

      {/* טקסטים ואימוג'י בשכבה נפרדת מעל החלון (אותו מיקום וגודל) — מחוץ ל-Pan של הסגירה,
          אחרת בתוך חלון קטן הוא «גונב» את הגרירה ואי אפשר להזיז אותם */}
      <View
        style={[s.previewFrame, s.overlayLayer, { top: cameraFrame.top, height: cameraFrame.height }]}
        pointerEvents={drawMode ? 'none' : 'box-none'}
      >
        {overlays.map((item) => (
          <DraggableText
            key={item.id}
            item={item}
            onDoubleTap={openTextEditor}
            onDragStateChange={(dragging, absY, hovering) => handleOverlayDragChange(item.id, dragging, absY, hovering)}
            onRequestDelete={handleOverlayDelete}
            onCommitPosition={handleOverlayCommitPosition}
            canvasH={cameraFrame.height}
            canvasTop={cameraFrame.top}
          />
        ))}
      </View>

      {/* פס עליון (מחוץ ל-Pan, מוסתר בזמן ציור): חזרה מימין, כלי טקסט/אימוג'י/ציור משמאל —
          על השחור מעל חלון המדיה, כמו וואטסאפ (לא עמודה מעל התמונה) */}
      {!drawMode && !showTextEditor && !showEmojiPicker && (
        <View style={[s.previewTopBar, s.chromeLayer, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
          <View style={s.previewTools}>
            <TouchableOpacity style={s.topIconBtn} onPress={() => setDrawMode(true)} activeOpacity={0.75} accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s18')}>
              <Ionicons name="brush-outline" size={22} color={M.text} />
            </TouchableOpacity>
            <TouchableOpacity style={s.topIconBtn} onPress={() => setShowEmojiPicker(true)} activeOpacity={0.75} accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s19')}>
              <Ionicons name="happy-outline" size={22} color={M.text} />
            </TouchableOpacity>
            <TouchableOpacity style={s.topIconBtn} onPress={() => openTextEditor()} activeOpacity={0.75} accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s20')}>
              <MaterialCommunityIcons name="format-text" size={22} color={M.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={s.topIconBtn}
            onPress={() => { setMediaUri(null); setOverlays([]); setDrawPaths([]); setDrawMode(false); setPhase('capture'); }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s21')}
          >
            <Ionicons name={dirIcon('chevron-forward')} size={26} color={M.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Drawing toolbar — outside dismiss Pan */}
      {drawMode && (
        <>
          <View style={[s.drawTopBar, s.chromeLayer, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              style={s.drawDonePill}
              onPress={() => setDrawMode(false)}
              activeOpacity={0.7}
            >
              <Text style={s.drawDoneText}>{i18n.t('auto.components__chat__AddStoryFullScreen.s1')}</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[s.drawIconBtn, drawPaths.length === 0 && { opacity: 0.4 }]}
              onPress={undoLastDraw}
              disabled={drawPaths.length === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-undo" size={20} color={M.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.drawIconBtn, drawPaths.length === 0 && { opacity: 0.4 }]}
              onPress={clearDrawing}
              disabled={drawPaths.length === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={M.text} />
            </TouchableOpacity>
          </View>

          <View style={[s.drawBottomBar, s.chromeLayer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.drawStrokeRow}>
              {DRAW_STROKE_WIDTHS.map((w) => (
                <TouchableOpacity
                  key={w}
                  onPress={() => setDrawStrokeWidth(w)}
                  style={[
                    s.strokeBtn,
                    drawStrokeWidth === w && s.strokeBtnActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: w * 1.3,
                    height: w * 1.3,
                    borderRadius: (w * 1.3) / 2,
                    backgroundColor: drawColor,
                  }} />
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.drawColorScroll}
              keyboardShouldPersistTaps="handled"
            >
              {DRAW_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setDrawColor(c)}
                  style={[
                    s.drawColorDot,
                    { backgroundColor: c },
                    drawColor === c && s.drawColorDotActive,
                  ]}
                />
              ))}
            </ScrollView>
          </View>
        </>
      )}

      {/* Bottom upload – ממורכז כמו FAB «תיק חדש» ב-PortfoliosHub */}
      {!drawMode && (
        <LinearGradient
          colors={['transparent', blackAlpha(0.65)]}
          style={[s.previewBottomGrad, s.chromeLayer, { paddingBottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <View style={s.sendRow}>
            <TouchableOpacity
              onPress={handleShareMedia}
              disabled={isUploading}
              style={[s.sendChevronBtn, isUploading && { opacity: 0.82 }]}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('auto.components__chat__AddStoryFullScreen.s17')}
            >
              <Ionicons name="arrow-up" size={26} color={M.text} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}

      {/* Trash drop zone – visible while dragging an overlay */}
      <TrashZone
        visible={!!draggingOverlayId}
        hovering={trashHover}
        bottomOffset={insets.bottom + 24}
      />

      <TextEditorOverlay
        visible={showTextEditor}
        initial={editingOverlay}
        onDone={handleTextEditorDone}
        onCancel={() => { setShowTextEditor(false); setEditingOverlayId(null); }}
      />

      <EmojiPickerOverlay
        visible={showEmojiPicker}
        onSelect={handleAddEmoji}
        onClose={() => setShowEmojiPicker(false)}
      />
    </View>
  );

  /* ═══════════════════════════════════════════════ */
  /* ═══════ RENDER ═══════════════════════════════ */
  /* ═══════════════════════════════════════════════ */
  // ב-Modal חייבים GestureHandlerRootView משלו (שורש נייטיב נפרד); במסך — יש כבר אחד בשורש האפליקציה.
  // שורש מקונן שהוסר באמצע נגיעה השאיר מחווה «תקועה» שחסמה הקשות בכל האפליקציה (גלילה עבדה, הקשה לא).
  const GestureRoot = presentation === 'screen' ? View : GestureHandlerRootView;
  const body = (
    <>
      {/* expo-status-bar (לא של RN): ב-Info.plist UIViewControllerBasedStatusBarAppearance=true — StatusBar של RN מדווח שגיאה */}
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <GestureRoot style={s.fullFlex}>
        {/*
          dismissY animates this root, but dismiss Pan is NOT wrapped around chrome.
          Capture: pans/pinch live only on the camera preview panel.
          Preview: dismiss wraps the media stack inside renderPreview; toolbars are siblings.
          A translate on an ancestor stops AVPlayerLayer from drawing (audio only, duration 0).
        */}
        <Reanimated.View
          style={[
            s.root,
            phase === 'preview' && mediaType === 'video' ? s.videoPreviewRoot : dismissAnimStyle,
          ]}
        >
          {phase === 'capture' && renderCapturePhase()}
          {phase === 'preview' && mediaUri && renderPreview()}
          {phase === 'capture' ? (
            <InAppGalleryPanel
              visible={inAppGalleryOpen}
              onClose={() => setInAppGalleryOpen(false)}
              onPick={onInAppGalleryPick}
            />
          ) : null}

          {/* Mode switcher — sibling outside all Pans */}
          {phase === 'capture' && (
            <View
              style={[s.modeSwitcherOverlay, s.chromeLayer, { bottom: insets.bottom + 14 }]}
              pointerEvents="box-none"
            >
              <View style={s.modeSwitcherTrack}>
                <Reanimated.View style={[s.modeSwitcherHighlight, indicatorAnimStyle]} />
                <TouchableOpacity
                  style={s.modePill}
                  onPress={() => {
                    logger.debug('AddStoryFullScreen', 'mode switch → camera');
                    switchMode('camera');
                  }}
                  activeOpacity={0.7}
                >
                  <Reanimated.Text style={[s.modePillText, cameraPillOpacity]}>{i18n.t('auto.components__chat__AddStoryFullScreen.s22')}</Reanimated.Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.modePill}
                  onPress={() => {
                    logger.debug('AddStoryFullScreen', 'mode switch → text');
                    switchMode('text');
                  }}
                  activeOpacity={0.7}
                >
                  <Reanimated.Text style={[s.modePillText, textPillOpacity]}>{i18n.t('auto.components__chat__AddStoryFullScreen.s20')}</Reanimated.Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* העלאה — הדיאלוג של האפליקציה (ספינר, בלי כפתורים) מעל הפריוויו המטושטש */}
          {phase === 'uploading' && mediaType === 'image' && mediaUri ? (
            <ExpoImage
              source={{ uri: mediaUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={40}
              transition={0}
            />
          ) : null}
          <InlineAppDialog
            visible={phase === 'uploading'}
            busy
            title={i18n.t('auto.components__chat__AddStoryFullScreen.s23')}
            message={i18n.t('auto.components__chat__AddStoryFullScreen.s24')}
          />
        </Reanimated.View>
      </GestureRoot>
    </>
  );

  if (presentation === 'screen') {
    return <View style={{ flex: 1, backgroundColor: M.base }}>{body}</View>;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════ */
/* ═══════ STYLES ════════════════════════════════ */
/* ═══════════════════════════════════════════════ */
