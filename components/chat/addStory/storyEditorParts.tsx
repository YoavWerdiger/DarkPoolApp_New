/** חלקי עורך הסטורי — הועברו מ-AddStoryFullScreen.tsx (פריט 52, פיצול קבצים ענקיים). */
import i18n from '../../../lib/i18n';
import { useState, useEffect, useRef } from 'react';
import { logger } from '../../../utils/logger';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Dimensions, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { chatPalette } from '../chatDesignTokens';
import type { TextInputInstance } from 'react-native';
import { silent } from '../../../utils/silentError';
import StaticDesignTokens from '../../ui/DesignTokens';

/** כרום מעל מדיה (מצלמה / סטורי) — טוקנים קבועים, פריט 44 */
export const M = StaticDesignTokens.colors.onMedia;

export const { width: SW, height: SH } = Dimensions.get('window');
export const GALLERY_THUMB = 52;
export const CAPTURE_SIZE = 66;
export const CAPTURE_RING = 80;
export const PILL_W = 76;
export const PILL_GAP = 4;
// זכוכית בהירה — כפתורי המצלמה יושבים על פסים שחורים (חלון הצילום), כהה נבלע ברקע
export const CHROME_FILL = 'rgba(255,255,255,0.16)';
export const CHROME_LINE = 'rgba(255,255,255,0.22)';

/** Camera keeps the recording file until the session stops. Copy first so preview playback is independent. */
export async function persistRecordedStoryVideo(uri: string): Promise<string> {
  const base = FileSystem.cacheDirectory;
  if (!base) return uri;
  const ext = uri.toLowerCase().includes('.mov') ? 'mov' : 'mp4';
  const dest = `${base}story-capture-${Date.now()}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    logger.warn('AddStoryFullScreen', 'persist recorded video failed', err);
    return uri;
  }
}

/* eslint-disable no-restricted-syntax -- פלטות שהמשתמש בוחר לטקסט / ציור / רקע: תוכן, לא צבעי ממשק */
export const GRADIENT_BACKGROUNDS: [string, string][] = [
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

export const OVERLAY_COLORS = [
  M.text, M.base, M.record, '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
  '#FF2D55', '#A2845E',
];

export const DRAW_COLORS = [
  M.text, M.base, M.record, '#FF9500', '#FFCC00',
  '#34C759', '#00C7BE', '#007AFF', '#AF52DE', '#FF2D55',
];

/* eslint-enable no-restricted-syntax */
export const DRAW_STROKE_WIDTHS = [3, 6, 10, 16];

/** ב-expo-camera, selectedLens תואם ל-localizedName ולא ל-deviceType — בוחרים עדשת wide 1x */
/**
 * בוחר את העדשה הרחבה הראשית. SDK 58: expo-camera מחזיר LensInfo ({ deviceType, localizedName })
 * במקום מחרוזות — name.toLowerCase() על אובייקט זרק «undefined is not a function» בתוך
 * onAvailableLensesChanged (בלי try) והקריס את מסך הוספת הסטורי בפרודקשן.
 * מחזיר את ה-deviceType (הערך ש-selectedLens מצפה לו); תומך גם בפורמט הישן (מחרוזת).
 */
export function pickWideAngleLens(lenses: readonly (string | { deviceType?: string; localizedName?: string })[]): string | undefined {
  if (!Array.isArray(lenses) || !lenses.length) return undefined;
  const scored = lenses
    .map((lens) => {
      const id = typeof lens === 'string' ? lens : lens?.deviceType ?? '';
      const label = typeof lens === 'string' ? lens : `${lens?.localizedName ?? ''} ${lens?.deviceType ?? ''}`;
      if (!id) return null;
      const n = label.toLowerCase();
      let score = 50;
      if (/ultra|אולטרה|fisheye/.test(n)) score -= 120;
      if (/tele|טלפוטו|טל\.?/.test(n)) score -= 60;
      if (/dual|triple|כפול|משולש/.test(n)) score -= 45;
      if (/truedepth|lidar|continuity|depth/.test(n)) score -= 90;
      if (/wide|רחב/.test(n)) score += 25;
      if (/back camera|rear camera|מצלמה אחורית/.test(n) && !/ultra|dual|triple/.test(n)) score += 40;
      score -= label.length * 0.15;
      return { id, score };
    })
    .filter((x): x is { id: string; score: number } => x != null);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id;
}

/** Prefer ~1080p–1440p — largest (4K) sizes lag preview + shutter on expo-camera. */
export function pickBestPictureSize(sizes: string[]): string | undefined {
  const TARGET = 1920 * 1080;
  const MAX_EDGE = 1920;
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  let fallback: string | undefined;
  let fallbackPixels = 0;

  for (const size of sizes) {
    const [w, h] = size.split('x').map(Number);
    if (!w || !h) continue;
    const edge = Math.max(w, h);
    const pixels = w * h;
    if (pixels > fallbackPixels && edge <= 2560) {
      fallbackPixels = pixels;
      fallback = size;
    }
    if (edge > 2560) continue;
    const oversizePenalty = edge > MAX_EDGE ? (edge - MAX_EDGE) * 400 : 0;
    const score = Math.abs(pixels - TARGET) + oversizePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = size;
    }
  }
  return best ?? fallback;
}

export const POPULAR_EMOJIS = [
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

export type BgStyle = 'none' | 'solid' | 'semi';
export type OverlayType = 'text' | 'emoji';

export interface TextOverlayItem {
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

export interface DrawPath {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
}

/* ─────────────── Draggable Text Component ─────────────── */
export const DELETE_Y_ACTIVATE = SH - 220; // start giving visual feedback here
export const DELETE_Y_TRIGGER = SH - 130;  // release below this = delete

export function DraggableText({
  item,
  onDoubleTap,
  onDragStateChange,
  onRequestDelete,
  onCommitPosition,
  canvasH = SH,
  canvasTop = 0,
}: {
  /** גובה הקנבס (חלון המדיה) והיסט שלו מראש המסך — הבסיס הוא מרכז הקנבס */
  canvasH?: number;
  canvasTop?: number;
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(silent('AddStoryFullScreen'));
  };
  const triggerHapticSelection = () => {
    Haptics.selectionAsync().catch(silent('AddStoryFullScreen'));
  };
  const triggerHapticSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(silent('AddStoryFullScreen'));
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
      onCommitPosition(item.id, savedTranslateX.value, savedTranslateY.value, scale.value);
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

      const absY = canvasTop + (canvasH / 2 - 60) + translateY.value;
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
      const absY = canvasTop + (canvasH / 2 - 60) + translateY.value;
      const willDelete = absY >= DELETE_Y_TRIGGER;
      if (willDelete) {
        // Shrink to nothing before removal
        scale.value = withTiming(0, { duration: 180 });
      } else {
        deleteProgress.value = withSpring(0, { damping: 20, stiffness: 200 });
        // שחרור מחוץ לחלון (למשל ליד הפח בלי למחוק) → חוזר פנימה. באנדרואיד מגע מחוץ
        // לגבולות שכבת החלון לא מגיע לטקסט — בלי זה הוא נתקע ואי אפשר לגרור אותו שוב
        const minY = -(canvasH / 2 - 60) + 8;
        const maxY = canvasH / 2 - 8;
        const maxX = SW / 2 - 48;
        const cy = Math.max(minY, Math.min(maxY, translateY.value));
        const cx = Math.max(-maxX, Math.min(maxX, translateX.value));
        if (cy !== translateY.value) translateY.value = withSpring(cy, { damping: 18, stiffness: 180 });
        if (cx !== translateX.value) translateX.value = withSpring(cx, { damping: 18, stiffness: 180 });
        savedTranslateX.value = cx;
        savedTranslateY.value = cy;
        runOnJS(notifyDragEnd)(canvasTop + (canvasH / 2 - 60) + cy);
        return;
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
      ? (item.color === M.text ? M.base : M.text)
      : item.bgStyle === 'semi'
        ? M.scrim
        : 'transparent';

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View style={[dragStyles.container, { top: canvasH / 2 - 60 }, animStyle]}>
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
              ? { fontSize: item.fontSize, color: M.text }
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

export const dragStyles = StyleSheet.create({
  container: {
    position: 'absolute',
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
export function TextEditorOverlay({
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
  const [color, setColor] = useState(initial?.color || M.text);
  const [bold, setBold] = useState(initial?.bold ?? true);
  const [bgStyle, setBgStyle] = useState<BgStyle>(initial?.bgStyle || 'none');
  const [fontSize, setFontSize] = useState(initial?.fontSize || 28);
  const inputRef = useRef<TextInputInstance>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setText(initial?.text || '');
      setColor(initial?.color || M.text);
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
    ? (color === M.text ? M.base : M.text)
    : bgStyle === 'semi'
      ? M.scrim
      : 'transparent';

  return (
    <KeyboardAvoidingView
      style={editorStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* לחיצה מחוץ לטקסט = סיום (כמו אינסטגרם). קודם זה היה ביטול — הטקסט שהוקלד נעלם */}
      <Pressable
        style={editorStyles.backdrop}
        onPress={() => {
          if (text.trim()) onDone(text.trim(), color, fontSize, bold, bgStyle);
          else onCancel();
        }}
      />

      <View style={[editorStyles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={editorStyles.doneBtn}
          onPress={() => {
            if (text.trim()) onDone(text.trim(), color, fontSize, bold, bgStyle);
            else onCancel();
          }}
        >
          <Text style={editorStyles.doneBtnText}>{i18n.t('auto.components__chat__AddStoryFullScreen.s1')}</Text>
        </TouchableOpacity>

        <View style={editorStyles.topTools}>
          <TouchableOpacity
            style={[editorStyles.toolBtn, bold && editorStyles.toolBtnActive]}
            onPress={() => setBold(!bold)}
          >
            <Text style={[editorStyles.toolBtnLabel, { fontWeight: '700' }]}>B</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[editorStyles.toolBtn, bgStyle !== 'none' && editorStyles.toolBtnActive]}
            onPress={cycleBgStyle}
          >
            <View style={[editorStyles.bgPreview, { backgroundColor: bgPreviewColor }]}>
              <Text style={{ color: bgStyle === 'solid' ? color : M.text, fontSize: 11, fontWeight: '700' }}>A</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={editorStyles.toolBtn}
            onPress={() => setFontSize(prev => prev >= 42 ? 18 : prev + 4)}
          >
            <MaterialCommunityIcons name="format-size" size={20} color={M.text} />
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
                fontWeight: bold ? '700' : '400',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder={i18n.t('auto.components__chat__AddStoryFullScreen.s2')}
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={150}
            textAlign="center"
          />
        </View>
      </View>

      <View style={editorStyles.colorRow}>
        {/* always — בלי זה הלחיצה הראשונה רק סוגרת מקלדת והצבע לא נבחר */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={editorStyles.colorScroll}
        >
          {OVERLAY_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setColor(c)}
              hitSlop={6}
              style={[editorStyles.colorRing, color === c && editorStyles.colorRingActive]}
            >
              <View
                style={[
                  editorStyles.colorDot,
                  { backgroundColor: c },
                  // לבן — קו כהה דק כדי שייראה עגול כמו שאר הצבעים
                  c === M.text && { borderColor: 'rgba(0,0,0,0.28)' },
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

export const editorStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: M.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  toolBtnLabel: {
    color: M.text,
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
    color: M.text,
    fontSize: 15,
    fontWeight: '600',
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
  // טבעת חיצונית לבחירה + עיגול צבע פנימי — כל הצבעים (כולל לבן) נראים עגולים ואחידים
  colorRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorRingActive: {
    borderColor: M.text,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});

/* ─────────────── Emoji Picker Overlay ─────────────── */
export function EmojiPickerOverlay({
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
          <Text style={emojiStyles.title}>{i18n.t('auto.components__chat__AddStoryFullScreen.s3')}</Text>
          <TouchableOpacity onPress={onClose} style={emojiStyles.closeBtn}>
            <Ionicons name="close" size={22} color={M.text} />
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

export const emojiStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
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
    color: M.text,
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
export function DrawingCanvas({
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
      style={StyleSheet.absoluteFill}
      pointerEvents={enabled ? 'auto' : 'none'}
      {...(enabled ? panResponder.panHandlers : {})}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
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
export function TrashZone({
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
  const hover = useSharedValue(0);

  // הופעה רכה (פייד) — לא קפיץ
  useEffect(() => {
    appear.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 220 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible]);

  useEffect(() => {
    hover.value = withTiming(hovering ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [hovering]);

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
        { translateY: interpolate(appear.value, [0, 1], [16, 0]) },
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

  // דעיכה כהה מתחתית המסך בזמן גרירה; מעל הפח — גוון אדום עדין
  const fadeStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  const dangerStyle = useAnimatedStyle(() => ({ opacity: appear.value * hover.value }));

  return (
    <>
    <Reanimated.View pointerEvents="none" style={[trashStyles.fade, fadeStyle]}>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
    </Reanimated.View>
    <Reanimated.View pointerEvents="none" style={[trashStyles.fade, dangerStyle]}>
      <LinearGradient colors={['transparent', 'rgba(229,57,53,0.38)']} style={StyleSheet.absoluteFill} />
    </Reanimated.View>
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
            color={M.text}
          />
        </Reanimated.View>
      </View>

      <Text style={[trashStyles.hint, hovering && trashStyles.hintActive]}>
        {hovering ? i18n.t('auto.components__chat__AddStoryFullScreen.s4') : i18n.t('auto.components__chat__AddStoryFullScreen.s5')}
      </Text>
    </Reanimated.View>
    </>
  );
}

export const trashStyles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    zIndex: 25,
  },
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
    backgroundColor: M.record,
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
    borderColor: M.text,
    borderWidth: 3,
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textShadowColor: M.scrimStrong,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  hintActive: {
    color: M.text,
    fontSize: 13,
    fontWeight: '700',
  },
});

/* ─────────────── Main Component ─────────────── */
export interface AddStoryFullScreenProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  /**
   * 'screen' = מסך בסטאק הראשי (AddStory) — בלי Modal של RN.
   * ה-Modal לא נסגר ב-iOS אחרי שיתוף (visible=false בלי onDismiss) ונשאר שקוף מעל הקהילה וחסם נגיעות.
   */
  presentation?: 'modal' | 'screen';
}

export type ScreenMode = 'camera' | 'text';
export type ScreenPhase = 'capture' | 'preview' | 'uploading';
