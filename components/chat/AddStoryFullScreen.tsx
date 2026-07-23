import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable, Image, Dimensions, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, FlatList, Animated, Keyboard } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
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

const { width: SW, height: SH } = Dimensions.get('window');
const GALLERY_THUMB = 56;
const CAPTURE_SIZE = 78;
const CAPTURE_RING = 88;
const PILL_W = 70;
const PILL_GAP = 6;

const GRADIENT_BACKGROUNDS: [string, string][] = [
  ['#0F2027', '#2C5364'],
  ['#1a1a2e', '#16213e'],
  ['#0f0c29', '#302b63'],
  ['#1B5E20', '#4CAF50'],
  ['#B71C1C', '#E53935'],
  ['#E65100', '#FF9800'],
  ['#4A148C', '#CE93D8'],
  ['#01579B', '#0288D1'],
  ['#004D40', '#26A69A'],
  ['#263238', '#546E7A'],
  ['#1B1B1B', '#3A3A3A'],
  ['#0D1117', '#21262D'],
];

const OVERLAY_COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
  '#FF2D55', '#A2845E',
];

const DRAW_COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#AF52DE', '#FF2D55',
];

const DRAW_STROKE_WIDTHS = [3, 6, 10, 16];

/** ב-expo-camera, selectedLens תואם ל-localizedName ולא ל-deviceType — בוחרים עדשת wide 1x */
function pickWideAngleLens(lenses: string[]): string | undefined {
  if (!lenses.length) return undefined;
  const scored = lenses.map((name) => {
    const n = name.toLowerCase();
    let score = 50;
    if (/ultra|אולטרה|fisheye/.test(n)) score -= 120;
    if (/tele|טלפוטו|טל\.?/.test(n)) score -= 60;
    if (/dual|triple|כפול|משולש/.test(n)) score -= 45;
    if (/truedepth|lidar|continuity|depth/.test(n)) score -= 90;
    if (/wide|רחב/.test(n)) score += 25;
    if (/back camera|rear camera|מצלמה אחורית/.test(n) && !/ultra|dual|triple/.test(n)) score += 40;
    score -= name.length * 0.15;
    return { name, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.name;
}

function pickBestPictureSize(sizes: string[]): string | undefined {
  let best: string | undefined;
  let bestPixels = 0;
  for (const size of sizes) {
    const [w, h] = size.split('x').map(Number);
    if (!w || !h) continue;
    const pixels = w * h;
    if (pixels > bestPixels) {
      bestPixels = pixels;
      best = size;
    }
  }
  return best;
}

const POPULAR_EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳',
  '😜','🤪','🤔','😏','😇','🙃','😅','😭','😱','🤯',
  '😡','🥵','🥶','🤒','🤕','🤢','👻','💀','👽','🤖',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💖',
  '💯','💥','✨','🔥','⭐','🌟','⚡','☀️','🌈','☁️',
  '👍','👎','👏','🙌','👌','✌️','🤞','🤟','🤘','🤙',
  '💪','🙏','👀','👁️','🧠','🫀','💋','👄','🦷','👅',
  '🎉','🎊','🎁','🎂','🍾','🥂','🍺','☕','🍕','🍔',
  '⚽','🏀','🏈','⚾','🎾','🏐','🏓','🎱','🎳','🏆',
  '🚀','✈️','🚗','🏠','🌍','📱','💻','🎮','🎧','📸',
  '💰','💵','💎','🔑','🎯','📈','📉','💡','⚠️','❓',
  '✅','❌','⭕','🆗','🆒','🔔','💤','💬','👑','🎩',
];

type BgStyle = 'none' | 'solid' | 'semi';
type OverlayType = 'text' | 'emoji';

interface TextOverlayItem {
  id: string;
  type?: OverlayType;
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  bgStyle: BgStyle;
  x: number;
  y: number;
  scale: number;
}

interface DrawPath {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
}

/* ─────────────── Draggable Text Component ─────────────── */
const DELETE_Y_ACTIVATE = SH - 220; // start giving visual feedback here
const DELETE_Y_TRIGGER = SH - 130;  // release below this = delete

function DraggableText({
  item,
  onDoubleTap,
  onDragStateChange,
  onRequestDelete,
  onCommitPosition,
}: {
  item: TextOverlayItem;
  onDoubleTap: (id: string) => void;
  onDragStateChange?: (dragging: boolean, y: number, hovering: boolean) => void;
  onRequestDelete?: (id: string) => void;
  onCommitPosition?: (id: string, x: number, y: number, scale: number) => void;
}) {
  const translateX = useSharedValue(item.x);
  const translateY = useSharedValue(item.y);
  const scale = useSharedValue(item.scale);
  const savedTranslateX = useSharedValue(item.x);
  const savedTranslateY = useSharedValue(item.y);
  const savedScale = useSharedValue(item.scale);

  // Continuous "close-to-trash" progress in [0..1] driven on UI thread for smoothness
  const deleteProgress = useSharedValue(0);
  const isDragging = useSharedValue(0);
  const wasHovering = useSharedValue(0);

  const triggerHapticImpact = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const triggerHapticSelection = () => {
    Haptics.selectionAsync().catch(() => {});
  };
  const triggerHapticSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  const notifyDragStart = () => {
    onDragStateChange?.(true, translateY.value, false);
    triggerHapticImpact();
  };
  const notifyDragMove = (absY: number, hovering: boolean) => {
    onDragStateChange?.(true, absY, hovering);
  };
  const notifyDragEnd = (absY: number) => {
    onDragStateChange?.(false, absY, false);
    const shouldDelete = absY >= DELETE_Y_TRIGGER;
    if (shouldDelete && onRequestDelete) {
      triggerHapticSuccess();
      // Let the shrink-to-0 animation play, then actually remove the item
      setTimeout(() => onRequestDelete(item.id), 180);
    } else if (onCommitPosition) {
      onCommitPosition(item.id, translateX.value, translateY.value, scale.value);
    }
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      isDragging.value = 1;
      wasHovering.value = 0;
      deleteProgress.value = 0;
      runOnJS(notifyDragStart)();
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;

      const absY = (SH / 2 - 60) + translateY.value;
      // Ramp from 0 (safe) → 1 (fully over trash)
      const raw = (absY - DELETE_Y_ACTIVATE) / (DELETE_Y_TRIGGER - DELETE_Y_ACTIVATE);
      const clamped = Math.max(0, Math.min(1, raw));
      deleteProgress.value = clamped;

      const hovering = absY >= DELETE_Y_TRIGGER;
      if (hovering && wasHovering.value === 0) {
        wasHovering.value = 1;
        runOnJS(triggerHapticSelection)();
      } else if (!hovering && wasHovering.value === 1) {
        wasHovering.value = 0;
        runOnJS(triggerHapticSelection)();
      }
      runOnJS(notifyDragMove)(absY, hovering);
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = 0;
      const absY = (SH / 2 - 60) + translateY.value;
      const willDelete = absY >= DELETE_Y_TRIGGER;
      if (willDelete) {
        // Shrink to nothing before removal
        scale.value = withTiming(0, { duration: 180 });
      } else {
        deleteProgress.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(notifyDragEnd)(absY);
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.5, Math.min(3, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onDoubleTap)(item.id);
    });

  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    doubleTapGesture,
  );

  const animStyle = useAnimatedStyle(() => {
    'worklet';
    // Shrink to 55% and fade to 40% opacity when fully over trash
    const shrink = interpolate(deleteProgress.value, [0, 1], [1, 0.55]);
    const fade = interpolate(deleteProgress.value, [0, 1], [1, 0.4]);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value * shrink },
      ],
      opacity: fade,
    };
  });

  const isEmoji = item.type === 'emoji';
  const bgColor = isEmoji
    ? 'transparent'
    : item.bgStyle === 'solid'
      ? (item.color === '#FFFFFF' ? '#000000' : '#FFFFFF')
      : item.bgStyle === 'semi'
        ? 'rgba(0,0,0,0.45)'
        : 'transparent';

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View style={[dragStyles.container, animStyle]}>
        <View style={[
          dragStyles.textPill,
          {
            backgroundColor: bgColor,
            borderRadius: !isEmoji && item.bgStyle !== 'none' ? 12 : 0,
            paddingHorizontal: !isEmoji && item.bgStyle !== 'none' ? 16 : 0,
            paddingVertical: !isEmoji && item.bgStyle !== 'none' ? 8 : 0,
          },
        ]}>
          <Text style={[
            dragStyles.text,
            isEmoji
              ? { fontSize: item.fontSize, color: '#fff' }
              : {
                  color: item.color,
                  fontSize: item.fontSize,
                  fontWeight: item.bold ? '800' : '400',
                },
          ]}>
            {item.text}
          </Text>
        </View>
      </Reanimated.View>
    </GestureDetector>
  );
}

const dragStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SH / 2 - 60,
    alignSelf: 'center',
    zIndex: 15,
  },
  textPill: {
    maxWidth: SW * 0.85,
  },
  text: {
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

/* ─────────────── Text Editor Overlay ─────────────── */
function TextEditorOverlay({
  visible,
  initial,
  onDone,
  onCancel,
}: {
  visible: boolean;
  initial?: TextOverlayItem | null;
  onDone: (text: string, color: string, fontSize: number, bold: boolean, bgStyle: BgStyle) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial?.text || '');
  const [color, setColor] = useState(initial?.color || '#FFFFFF');
  const [bold, setBold] = useState(initial?.bold ?? true);
  const [bgStyle, setBgStyle] = useState<BgStyle>(initial?.bgStyle || 'none');
  const [fontSize, setFontSize] = useState(initial?.fontSize || 28);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setText(initial?.text || '');
      setColor(initial?.color || '#FFFFFF');
      setBold(initial?.bold ?? true);
      setBgStyle(initial?.bgStyle || 'none');
      setFontSize(initial?.fontSize || 28);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  if (!visible) return null;

  const cycleBgStyle = () => {
    const order: BgStyle[] = ['none', 'solid', 'semi'];
    const idx = order.indexOf(bgStyle);
    setBgStyle(order[(idx + 1) % order.length]);
  };

  const bgPreviewColor = bgStyle === 'solid'
    ? (color === '#FFFFFF' ? '#000' : '#fff')
    : bgStyle === 'semi'
      ? 'rgba(0,0,0,0.45)'
      : 'transparent';

  return (
    <KeyboardAvoidingView
      style={editorStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable style={editorStyles.backdrop} onPress={onCancel} />

      <View style={[editorStyles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={editorStyles.doneBtn}
          onPress={() => {
            if (text.trim()) onDone(text.trim(), color, fontSize, bold, bgStyle);
            else onCancel();
          }}
        >
          <Text style={editorStyles.doneBtnText}>סיום</Text>
        </TouchableOpacity>

        <View style={editorStyles.topTools}>
          <TouchableOpacity
            style={[editorStyles.toolBtn, bold && editorStyles.toolBtnActive]}
            onPress={() => setBold(!bold)}
          >
            <Text style={[editorStyles.toolBtnLabel, { fontWeight: '800' }]}>B</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[editorStyles.toolBtn, bgStyle !== 'none' && editorStyles.toolBtnActive]}
            onPress={cycleBgStyle}
          >
            <View style={[editorStyles.bgPreview, { backgroundColor: bgPreviewColor }]}>
              <Text style={{ color: bgStyle === 'solid' ? color : '#fff', fontSize: 11, fontWeight: '700' }}>A</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={editorStyles.toolBtn}
            onPress={() => setFontSize(prev => prev >= 42 ? 18 : prev + 4)}
          >
            <MaterialCommunityIcons name="format-size" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={editorStyles.inputArea}>
        <View style={[
          editorStyles.inputPreview,
          {
            backgroundColor: bgPreviewColor,
            borderRadius: bgStyle !== 'none' ? 14 : 0,
            paddingHorizontal: bgStyle !== 'none' ? 18 : 0,
            paddingVertical: bgStyle !== 'none' ? 10 : 0,
          },
        ]}>
          <TextInput
            ref={inputRef}
            style={[
              editorStyles.input,
              {
                color,
                fontSize,
                fontWeight: bold ? '800' : '400',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder="הקלד טקסט..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={150}
            textAlign="center"
          />
        </View>
      </View>

      <View style={editorStyles.colorRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={editorStyles.colorScroll}
        >
          {OVERLAY_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              style={[
                editorStyles.colorDot,
                { backgroundColor: c },
                color === c && editorStyles.colorDotActive,
              ]}
            />
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const editorStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 31,
  },
  topTools: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  toolBtnLabel: {
    color: '#fff',
    fontSize: 16,
  },
  bgPreview: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtn: {
    backgroundColor: chatPalette.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  inputArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 31,
  },
  inputPreview: {
    maxWidth: SW * 0.85,
    minWidth: 100,
  },
  input: {
    textAlign: 'center',
    minHeight: 50,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  colorRow: {
    paddingBottom: 20,
    zIndex: 31,
  },
  colorScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  colorDotActive: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
});

/* ─────────────── Emoji Picker Overlay ─────────────── */
function EmojiPickerOverlay({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={emojiStyles.root}>
      <Pressable style={emojiStyles.backdrop} onPress={onClose} />
      <View style={[emojiStyles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={emojiStyles.handle} />
        <View style={emojiStyles.header}>
          <Text style={emojiStyles.title}>הוסף אימוג'י</Text>
          <TouchableOpacity onPress={onClose} style={emojiStyles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={emojiStyles.grid}
        >
          {POPULAR_EMOJIS.map((e, i) => (
            <TouchableOpacity
              key={`${e}-${i}`}
              style={emojiStyles.emojiBtn}
              onPress={() => onSelect(e)}
              activeOpacity={0.6}
            >
              <Text style={emojiStyles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const emojiStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: 'rgba(24,24,28,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SH * 0.55,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 12,
  },
  emojiBtn: {
    width: (SW - 24) / 7,
    height: (SW - 24) / 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 32,
  },
});

/* ─────────────── Drawing Canvas ─────────────── */
function DrawingCanvas({
  paths,
  color,
  strokeWidth,
  onPathComplete,
  enabled,
}: {
  paths: DrawPath[];
  color: string;
  strokeWidth: number;
  onPathComplete: (path: DrawPath) => void;
  enabled: boolean;
}) {
  const [currentD, setCurrentD] = useState<string>('');
  const currentDRef = useRef<string>('');

  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const onPathCompleteRef = useRef(onPathComplete);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { onPathCompleteRef.current = onPathComplete; }, [onPathComplete]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const d = `M ${locationX.toFixed(2)} ${locationY.toFixed(2)}`;
        currentDRef.current = d;
        setCurrentD(d);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const d = `${currentDRef.current} L ${locationX.toFixed(2)} ${locationY.toFixed(2)}`;
        currentDRef.current = d;
        setCurrentD(d);
      },
      onPanResponderRelease: () => {
        if (currentDRef.current) {
          onPathCompleteRef.current({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            d: currentDRef.current,
            color: colorRef.current,
            strokeWidth: strokeWidthRef.current,
          });
        }
        currentDRef.current = '';
        setCurrentD('');
      },
      onPanResponderTerminate: () => {
        currentDRef.current = '';
        setCurrentD('');
      },
    })
  ).current;

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={enabled ? 'auto' : 'none'}
      {...(enabled ? panResponder.panHandlers : {})}
    >
      <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {paths.map((p) => (
          <Path
            key={p.id}
            d={p.d}
            stroke={p.color}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {currentD ? (
          <Path
            d={currentD}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </Svg>
    </View>
  );
}

/* ─────────────── Trash Drop Zone ─────────────── */
function TrashZone({
  visible,
  hovering,
  bottomOffset,
}: {
  visible: boolean;
  hovering: boolean;
  bottomOffset: number;
}) {
  const appear = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    appear.value = withSpring(visible ? 1 : 0, { damping: 18, stiffness: 220, mass: 0.6 });
  }, [visible]);

  useEffect(() => {
    if (hovering) {
      // Loop-ish pulse using two-step timing
      pulse.value = withTiming(1.28, { duration: 220 }, () => {
        'worklet';
        pulse.value = withTiming(1.12, { duration: 240 });
      });
    } else {
      pulse.value = withSpring(1, { damping: 18, stiffness: 220 });
    }
  }, [hovering]);

  const wrapStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: appear.value,
      transform: [
        { translateY: interpolate(appear.value, [0, 1], [40, 0]) },
      ],
    };
  });

  const bgStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: pulse.value }],
    };
  });

  // Radial glow that intensifies when hovering
  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    const spread = hovering ? 1.9 : 1.2;
    return {
      opacity: appear.value * (hovering ? 0.65 : 0.22),
      transform: [{ scale: pulse.value * spread }],
    };
  });

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[trashStyles.zone, { bottom: bottomOffset }, wrapStyle]}
    >
      <View style={trashStyles.stack}>
        <Reanimated.View style={[trashStyles.glow, glowStyle]} />

        <Reanimated.View style={[
          trashStyles.circle,
          hovering && trashStyles.circleActive,
          bgStyle,
        ]}>
          <Ionicons
            name={hovering ? 'trash' : 'trash-outline'}
            size={hovering ? 30 : 24}
            color="#fff"
          />
        </Reanimated.View>
      </View>

      <Text style={[trashStyles.hint, hovering && trashStyles.hintActive]}>
        {hovering ? 'שחרר למחיקה' : 'גרור לכאן למחיקה'}
      </Text>
    </Reanimated.View>
  );
}

const trashStyles = StyleSheet.create({
  zone: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 28,
  },
  stack: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FF3B30',
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: {
    backgroundColor: 'rgba(255,59,48,0.95)',
    borderColor: '#fff',
    borderWidth: 3,
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  hintActive: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

/* ─────────────── Main Component ─────────────── */
interface AddStoryFullScreenProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type ScreenMode = 'camera' | 'text';
type ScreenPhase = 'capture' | 'preview' | 'uploading';

export default function AddStoryFullScreen({ visible, onClose, onAdded }: AddStoryFullScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ScreenMode>('camera');
  const [phase, setPhase] = useState<ScreenPhase>('capture');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  /** iOS: שם עדשה מקומי (לא deviceType) — בוחרים wide 1x ולא ultrawide 0.5x */
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textBgIndex, setTextBgIndex] = useState(0);
  const [recentPhotos, setRecentPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [galleryExpanded, setGalleryExpanded] = useState(false);

  const textInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraView>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [overlays, setOverlays] = useState<TextOverlayItem[]>([]);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const captureAreaRef = useRef<View>(null);

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
    if (target === 'text') {
      setTimeout(() => textInputRef.current?.focus(), 350);
    }
  }, []);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      dragStartIndex.value = modeIndex.value;
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
    });

  const stripAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -modeIndex.value * SW }],
  }));

  /* ── Swipe-down-to-close gesture (Instagram/WhatsApp-like) ── */
  const dismissY = useSharedValue(0);
  const DISMISS_THRESHOLD = SH * 0.2;
  const DISMISS_VELOCITY = 900;

  const triggerCloseHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleDismissClose = useCallback(() => {
    cancelAnimation(dismissY);
    dismissY.value = 0;
    Keyboard.dismiss();
    triggerCloseHaptic();
    onClose();
  }, [onClose]);

  // Disable dismiss while: uploading, drawing, recording video, or interactive modals are open
  const dismissDisabled =
    phase === 'uploading' ||
    drawMode ||
    isRecording ||
    showTextEditor ||
    showEmojiPicker;

  const dismissGesture = Gesture.Pan()
    .activeOffsetY([25, 9999])
    .failOffsetX([-30, 30])
    .enabled(!dismissDisabled)
    .onUpdate((e) => {
      'worklet';
      dismissY.value = e.translationY > 0
        ? e.translationY
        : e.translationY * 0.15;
    })
    .onEnd((e) => {
      'worklet';
      const dist = dismissY.value;
      const shouldClose = dist > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY;
      if (shouldClose) {
        runOnJS(handleDismissClose)();
      } else {
        dismissY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
      }
    });

  const dismissAnimStyle = useAnimatedStyle(() => {
    'worklet';
    const clamped = Math.max(0, dismissY.value);
    return {
      transform: [{ translateY: clamped }],
      opacity: interpolate(clamped, [0, SH * 0.55], [1, 0.5], Extrapolation.CLAMP),
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
      setIsUploading(false);
      setTextContent('');
      setTextBgIndex(0);
      setOverlays([]);
      setShowTextEditor(false);
      setEditingOverlayId(null);
      setIsRecording(false);
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
      loadRecentPhotos();
      if (!permission?.granted) {
        requestPermission();
      }
    }
  }, [visible]);

  useEffect(() => {
    if (mode === 'text') {
      setTimeout(() => textInputRef.current?.focus(), 350);
    }
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
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return;
      const media = await MediaLibrary.getAssetsAsync({
        first: 30,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      });
      setRecentPhotos(media.assets);
    } catch (error) {
      logger.error('AddStoryFullScreen', 'Failed to load recent photos', error);
    }
  };

  const selectRecentPhoto = async (asset: MediaLibrary.Asset) => {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      const uri = info.localUri;
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
        if (best) setPictureSize(best);
      }
    } catch (err) {
      logger.warn('AddStoryFullScreen', 'Camera configure failed', err);
    }
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        shutterSound: true,
      });
      if (photo?.uri) {
        setMediaUri(photo.uri);
        setMediaType('image');
        setOverlays([]);
        setPhase('preview');
      }
    } catch (err) {
      logger.error('AddStoryFullScreen', 'Take picture failed', err);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    try {
      setIsRecording(true);
      recordTimerRef.current = setTimeout(() => {
        stopRecording();
      }, 30000);
      const video = await cameraRef.current.recordAsync?.({ maxDuration: 30 });
      if (video?.uri) {
        setMediaUri(video.uri);
        setMediaType('video');
        setOverlays([]);
        setPhase('preview');
      }
    } catch (err) {
      logger.error('AddStoryFullScreen', 'Recording failed', err);
    } finally {
      setIsRecording(false);
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    cameraRef.current?.stopRecording?.();
  };

  const openGallery = async () => {
    if (!user?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      legacyAlert('אישור נדרש', 'אנא אשר גישה לגלריה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
      videoMaxDuration: 30,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || ('duration' in asset && (asset as any).duration > 0);
    setMediaUri(asset.uri);
    setMediaType(isVideo ? 'video' : 'image');
    setOverlays([]);
    setGalleryExpanded(false);
    setPhase('preview');
  };

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
      color: '#FFFFFF',
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
            canvasHeight: SH,
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

      setIsUploading(true);
      setPhase('uploading');

      const { url, error } = mediaType === 'video'
        ? await uploadStoryVideo(mediaUri, user.id)
        : await uploadStoryImage(mediaUri, user.id);

      logger.debug('AddStoryFullScreen', `Upload result: url=${url}, error=${error}, contentLen=${overlayContent?.length ?? 0}`);

      if (error || !url) {
        legacyAlert('שגיאה', error || 'לא הצלחנו להעלות');
        setPhase('preview');
        return;
      }

      await createStory(user.id, {
        media_type: mediaType,
        media_url: url,
        content: overlayContent,
      });

      logger.debug('AddStoryFullScreen', 'Story created successfully');
      onAdded();
      onClose();
    } catch (e: any) {
      logger.error('AddStoryFullScreen', 'Share failed', e);
      legacyAlert('שגיאה', e?.message || 'משהו השתבש');
      setPhase('preview');
    } finally {
      setIsUploading(false);
    }
  };

  const handleShareText = async () => {
    if (!user?.id || !textContent.trim()) return;
    setIsUploading(true);
    setPhase('uploading');
    try {
      const bg = GRADIENT_BACKGROUNDS[textBgIndex];
      await createStory(user.id, {
        media_type: 'text',
        content: textContent.trim(),
        background_color: bg[0],
      });
      onAdded();
      onClose();
    } catch (e: any) {
      legacyAlert('שגיאה', e?.message || 'משהו השתבש');
      setMode('text');
      setPhase('capture');
    } finally {
      setIsUploading(false);
    }
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
  const renderCapturePhase = () => (
    <GestureDetector gesture={swipeGesture}>
      <Reanimated.View style={[s.modeStrip, stripAnimStyle]}>
        {/* ── Panel 0: Camera ── */}
        <View style={s.modePanel}>
          {/* Live camera feed */}
          {permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={facing}
              mode={isRecording ? 'video' : 'picture'}
              flash={flash ? 'on' : 'off'}
              zoom={0}
              videoQuality="1080p"
              {...(pictureSize ? { pictureSize } : {})}
              {...(selectedLens ? { selectedLens } : {})}
              onCameraReady={configureCamera}
              onAvailableLensesChanged={({ lenses }) => {
                const wide = pickWideAngleLens(lenses);
                if (wide && wide !== selectedLens) setSelectedLens(wide);
              }}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.2)" />
              <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
                <Text style={s.permissionBtnText}>אפשר גישה למצלמה</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Dark vignette overlays */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent']}
            style={s.vignetteTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={s.vignetteBottom}
            pointerEvents="none"
          />

          {/* Top controls */}
          <View style={[s.cameraTopBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={s.topIconBtn} onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={s.topIconBtn}
              onPress={() => setFlash(!flash)}
            >
              <Ionicons name={flash ? 'flash' : 'flash-off'} size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={[s.cameraBottom, { paddingBottom: insets.bottom + 52 }]}>
            {/* Gallery strip (expandable) */}
            <Animated.View style={[s.galleryExpanded, { height: galleryHeight, overflow: 'hidden' }]}>
              {galleryExpanded && (
                <FlatList
                  data={recentPhotos}
                  numColumns={3}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.galleryGrid}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={s.galleryGridItem}
                      onPress={() => selectRecentPhoto(item)}
                      activeOpacity={0.7}
                    >
                      <ExpoImage source={{ uri: item.uri }} style={s.galleryGridImg} />
                      {item.mediaType === 'video' && (
                        <View style={s.gridVideoTag}>
                          <Ionicons name="play" size={10} color="#fff" />
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

            {/* Capture row */}
            <View style={s.captureRow}>
              <TouchableOpacity
                style={s.galleryBtn}
                onPress={() => {
                  if (galleryExpanded) {
                    setGalleryExpanded(false);
                  } else if (recentPhotos.length > 0) {
                    setGalleryExpanded(true);
                  } else {
                    openGallery();
                  }
                }}
                activeOpacity={0.8}
              >
                {recentPhotos.length > 0 ? (
                  <ExpoImage source={{ uri: recentPhotos[0].uri }} style={s.galleryBtnImg} />
                ) : (
                  <Ionicons name="images" size={24} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.captureOuter}
                onPress={takePicture}
                onLongPress={startRecording}
                onPressOut={() => { if (isRecording) stopRecording(); }}
                activeOpacity={0.7}
                delayLongPress={300}
              >
                <View style={[
                  s.captureInner,
                  isRecording && s.captureRecording,
                ]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.flipBtn}
                onPress={() => {
                  setSelectedLens(undefined);
                  setPictureSize(undefined);
                  setFacing((f) => (f === 'back' ? 'front' : 'back'));
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* ── Panel 1: Text ── */}
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
              {/* Top bar */}
              <View style={[s.cameraTopBar, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={s.topIconBtn} onPress={onClose}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[s.textDoneBtn, !textContent.trim() && { opacity: 0.4 }]}
                  onPress={handleShareText}
                  disabled={!textContent.trim() || isUploading}
                >
                  <Ionicons name="paper-plane" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={s.textDoneBtnLabel}>שתף</Text>
                </TouchableOpacity>
              </View>

              {/* Text input */}
              <View style={s.textInputArea}>
                <TextInput
                  ref={textInputRef}
                  style={s.textBigInput}
                  placeholder="מה על הלב?..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={textContent}
                  onChangeText={setTextContent}
                  multiline
                  maxLength={250}
                  textAlign="center"
                />
                <Text style={s.textCounter}>{textContent.length}/250</Text>
              </View>

              {/* Background picker */}
              <View style={[s.textBgPicker, { paddingBottom: insets.bottom + 52 }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.textBgScroll}
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
    </GestureDetector>
  );

  /* ═══════════════════════════════════════════════ */
  /* ═══════ PREVIEW PHASE ════════════════════════ */
  /* ═══════════════════════════════════════════════ */
  const renderPreview = () => (
    <View style={s.fullFlex}>
      <View
        ref={captureAreaRef}
        style={StyleSheet.absoluteFillObject}
        collapsable={false}
      >
        <View style={StyleSheet.absoluteFillObject}>
          {mediaType === 'image' ? (
            <Image source={{ uri: mediaUri! }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <Video
              source={{ uri: mediaUri! }}
              style={StyleSheet.absoluteFillObject}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
            />
          )}
        </View>

        {/* Drawing layer (always rendered; captures input only when drawMode is on) */}
        <DrawingCanvas
          paths={drawPaths}
          color={drawColor}
          strokeWidth={drawStrokeWidth}
          onPathComplete={(p) => setDrawPaths(prev => [...prev, p])}
          enabled={drawMode}
        />

        {overlays.map((item) => (
          <DraggableText
            key={item.id}
            item={item}
            onDoubleTap={openTextEditor}
            onDragStateChange={(dragging, absY, hovering) => handleOverlayDragChange(item.id, dragging, absY, hovering)}
            onRequestDelete={handleOverlayDelete}
            onCommitPosition={handleOverlayCommitPosition}
          />
        ))}
      </View>

      {/* Top bar – hidden while drawing */}
      {!drawMode && (
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={[s.previewTopGrad, { paddingTop: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          {/* direction:ltr — כמו StoryViewer: Modal לא תמיד מכבד forceRTL */}
          <View style={s.previewTopRow}>
            <View style={s.previewToolbar}>
              <TouchableOpacity style={s.previewToolBtn} onPress={() => openTextEditor()} activeOpacity={0.7}>
                <MaterialCommunityIcons name="format-text" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.previewToolBtn}
                onPress={() => setShowEmojiPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="happy-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.previewToolBtn}
                onPress={() => setDrawMode(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="brush-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => { setMediaUri(null); setOverlays([]); setDrawPaths([]); setDrawMode(false); setPhase('capture'); }}
              hitSlop={16}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="חזרה"
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}

      {/* Drawing toolbar */}
      {drawMode && (
        <>
          <View style={[s.drawTopBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              style={s.drawIconBtn}
              onPress={() => setDrawMode(false)}
              activeOpacity={0.7}
            >
              <Text style={s.drawDoneText}>סיום</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[s.drawIconBtn, drawPaths.length === 0 && { opacity: 0.4 }]}
              onPress={undoLastDraw}
              disabled={drawPaths.length === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-undo" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.drawIconBtn, drawPaths.length === 0 && { opacity: 0.4 }]}
              onPress={clearDrawing}
              disabled={drawPaths.length === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[s.drawBottomBar, { paddingBottom: insets.bottom + 20 }]}>
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
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={[s.previewBottomGrad, { paddingBottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={handleShareMedia}
            disabled={isUploading}
            style={[s.shareFabBtn, isUploading && { opacity: 0.82 }]}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="העלאה"
          >
            <Text style={s.shareFabBtnText}>העלאה</Text>
          </TouchableOpacity>
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GestureHandlerRootView style={s.fullFlex}>
        <GestureDetector gesture={dismissGesture}>
          <Reanimated.View style={[s.root, dismissAnimStyle]}>
            {phase === 'capture' && renderCapturePhase()}
            {phase === 'preview' && mediaUri && renderPreview()}

            {/* Animated mode switcher – floats above everything in capture phase */}
            {phase === 'capture' && (
              <View style={[s.modeSwitcherOverlay, { bottom: insets.bottom + 14 }]}>
                <View style={s.modeSwitcherTrack}>
                  {/* Animated highlight pill */}
                  <Reanimated.View style={[s.modeSwitcherHighlight, indicatorAnimStyle]} />
                  <TouchableOpacity style={s.modePill} onPress={() => switchMode('camera')} activeOpacity={0.7}>
                    <Reanimated.Text style={[s.modePillText, cameraPillOpacity]}>מצלמה</Reanimated.Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modePill} onPress={() => switchMode('text')} activeOpacity={0.7}>
                    <Reanimated.Text style={[s.modePillText, textPillOpacity]}>טקסט</Reanimated.Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {phase === 'uploading' && (
              <View style={s.uploadOverlay}>
                <View style={s.uploadCard}>
                  <ActivityIndicator size="large" color={chatPalette.primary} />
                  <Text style={s.uploadTitle}>מעלה סטטוס...</Text>
                  <Text style={s.uploadSub}>רק רגע</Text>
                </View>
              </View>
            )}
          </Reanimated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════ */
/* ═══════ STYLES ════════════════════════════════ */
/* ═══════════════════════════════════════════════ */
const s = StyleSheet.create({
  fullFlex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  /* ---- Horizontal swipe strip ---- */
  modeStrip: {
    flexDirection: 'row',
    width: SW * 2,
    height: '100%',
  },
  modePanel: {
    width: SW,
    height: '100%',
  },

  /* ---- Camera top ---- */
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 20,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 5,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
    zIndex: 5,
  },

  /* ---- Camera bottom ---- */
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },

  galleryExpanded: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  galleryGrid: {
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  galleryGridItem: {
    flex: 1 / 3,
    aspectRatio: 0.75,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  galleryGridImg: {
    width: '100%',
    height: '100%',
  },
  gridVideoTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  gridVideoDuration: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },

  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 32,
  },

  galleryBtn: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryBtnImg: {
    width: '100%',
    height: '100%',
  },

  captureOuter: {
    width: CAPTURE_RING,
    height: CAPTURE_RING,
    borderRadius: CAPTURE_RING / 2,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    backgroundColor: '#fff',
  },
  captureRecording: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },

  flipBtn: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: GALLERY_THUMB / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ---- Mode switcher overlay ---- */
  modeSwitcherOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 25,
    pointerEvents: 'box-none',
  },
  modeSwitcherTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    padding: 3,
    gap: PILL_GAP,
  },
  modeSwitcherHighlight: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: PILL_W,
    height: 32,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  modePill: {
    width: PILL_W,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  modePillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---- Permission fallback ---- */
  permissionBtn: {
    marginTop: 20,
    backgroundColor: chatPalette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- Text mode ---- */
  textDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chatPalette.primary,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  textDoneBtnLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  textInputArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  textBigInput: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 42,
    minHeight: 80,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  textCounter: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  textBgPicker: {
    paddingTop: 4,
  },
  textBgScroll: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  bgDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bgDotActive: {
    borderColor: '#fff',
    borderWidth: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  /* ---- Preview ---- */
  previewTopGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 30,
    zIndex: 10,
  },
  previewTopRow: {
    /** כמו StoryViewer progressRow — נועל LTR כדי שהסדר לא יהפוך פעמיים ב-Modal */
    flexDirection: 'row',
    direction: 'ltr',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewToolbar: {
    flexDirection: 'row',
    direction: 'ltr',
    gap: 8,
  },
  previewToolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 50,
    zIndex: 10,
    alignItems: 'center',
  },
  /** כמו fabBtn ב-PortfoliosHubScreen / PortfolioDetailScreen */
  shareFabBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: chatPalette.primary,
  },
  shareFabBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  /* ---- Drawing mode ---- */
  drawTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 25,
  },
  drawIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  drawDoneText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  drawBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawStrokeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
  },
  strokeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  strokeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: '#fff',
  },
  drawColorScroll: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  drawColorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  drawColorDotActive: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.18 }],
  },

  /* ---- Trash drop zone ---- */
  trashZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 28,
  },
  trashCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashCircleActive: {
    backgroundColor: 'rgba(255,59,48,0.85)',
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  trashHint: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ---- Upload overlay ---- */
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  uploadCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 56,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  uploadTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  uploadSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
});
