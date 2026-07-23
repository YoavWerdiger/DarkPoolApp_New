// ============================================
// Voice Waveform — מהירות גלילה ו-FPS מסונכרנים
// translateX נע ב-px/s = STRIDE * bars/s; דחיפת בר בדיוק כשעוברים STRIDE.
// ============================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  type SharedValue,
} from 'react-native-reanimated';
import { useDesignTokens } from '../ui/DesignTokens';

interface VoiceWaveformProps {
  isRecording: boolean;
  audioLevelRef?: React.MutableRefObject<number>;
}

const MIN_H = 2.5;
const MAX_H = 26;
const TRACK_H = 28;
const BAR_W = 2.5;
const BAR_GAP = 1.5;
const STRIDE = BAR_W + BAR_GAP;
/** כמה ברים חדשים בשנייה — קובע גם את מהירות ה-translate */
const BARS_PER_SEC = 16;
const SCROLL_SPEED_PX_S = STRIDE * BARS_PER_SEC; // = מסונכרן במדויק
const EXTRA_BARS = 8;
const SILENCE = 0.018;

function WaveBar({
  index,
  historySV,
  color,
}: {
  index: number;
  historySV: SharedValue<number[]>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const lvl = historySV.value[index] ?? 0;
    return {
      height: MIN_H + lvl * (MAX_H - MIN_H),
      backgroundColor: color,
    };
  });

  return (
    <View style={styles.barCell}>
      <Animated.View style={[styles.bar, style]} />
    </View>
  );
}

export default function VoiceWaveform({ isRecording, audioLevelRef }: VoiceWaveformProps) {
  const tokens = useDesignTokens();
  const barColor = tokens.colors.text.secondary;

  const [trackW, setTrackW] = useState(0);
  const visibleCount = Math.max(24, Math.ceil(trackW / STRIDE) + 2);
  const totalBars = visibleCount + EXTRA_BARS;

  const historySV = useSharedValue<number[]>(Array(totalBars).fill(0));
  const inputSV = useSharedValue(0);
  const liveSV = useSharedValue(0);
  const offsetX = useSharedValue(0);
  const recordingSV = useSharedValue(0);
  const barCountSV = useSharedValue(totalBars);

  useEffect(() => {
    barCountSV.value = totalBars;
    historySV.value = Array(totalBars).fill(0);
    offsetX.value = 0;
    liveSV.value = 0;
  }, [totalBars, barCountSV, historySV, offsetX, liveSV]);

  useEffect(() => {
    if (!isRecording) {
      recordingSV.value = 0;
      liveSV.value = 0;
      inputSV.value = 0;
      offsetX.value = 0;
      historySV.value = Array(totalBars).fill(0);
      return;
    }

    recordingSV.value = 1;
    historySV.value = Array(totalBars).fill(0);
    offsetX.value = 0;
    liveSV.value = 0;

    let raf = 0;
    const pump = () => {
      const raw = Math.max(0, Math.min(1, audioLevelRef?.current ?? 0));
      // gamma נמוך + gain — דיבור רך עדיין מזיז ברים
      inputSV.value =
        raw < SILENCE ? 0 : Math.min(1, Math.pow(raw, 0.48) * 1.55);
      raf = requestAnimationFrame(pump);
    };
    raf = requestAnimationFrame(pump);

    return () => {
      cancelAnimationFrame(raf);
      recordingSV.value = 0;
    };
  }, [
    isRecording,
    audioLevelRef,
    totalBars,
    recordingSV,
    liveSV,
    inputSV,
    offsetX,
    historySV,
  ]);

  useFrameCallback((frame) => {
    'worklet';
    if (recordingSV.value < 0.5) return;

    const dt = Math.min(1 / 30, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const n = barCountSV.value;

    // 1) עוצמה חיה — דעיכה איטית יותר כדי שדיבור רך יישאר גלוי
    const target = inputSV.value;
    if (target <= 0) {
      liveSV.value = liveSV.value < 0.02 ? 0 : liveSV.value * 0.62;
    } else {
      liveSV.value = liveSV.value * 0.22 + target * 0.78;
    }

    // 2) תמיד מעדכנים את הבר האחרון באותו פריים — אין "בר חי" נפרד שיוצא מסנכרון
    {
      const cur = historySV.value;
      if (cur.length === n) {
        const tip = cur.slice();
        tip[n - 1] = liveSV.value;
        historySV.value = tip;
      }
    }

    // 3) גלילה מסונכרנת: px/s = STRIDE * bars/s → בר חדש בדיוק כשעוברים רוחב בר
    let x = offsetX.value + SCROLL_SPEED_PX_S * dt;

    // לכל היותר בר אחד לפריים — שומר סנכרון גם ב-frame drop
    if (x >= STRIDE) {
      x -= STRIDE;
      const prev = historySV.value;
      const next = new Array(n);
      for (let i = 0; i < n - 1; i++) {
        next[i] = prev[i + 1] ?? 0;
      }
      next[n - 1] = liveSV.value;
      historySV.value = next;
    }

    offsetX.value = x;
  }, isRecording);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -offsetX.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - trackW) > 1) setTrackW(w);
  };

  const indices = useMemo(
    () => Array.from({ length: totalBars }, (_, i) => i),
    [totalBars],
  );

  return (
    <View style={styles.clip} onLayout={onLayout}>
      <Animated.View style={[styles.row, { width: totalBars * STRIDE }, rowStyle]}>
        {indices.map((index) => (
          <WaveBar
            key={index}
            index={index}
            historySV={historySV}
            color={barColor}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    minWidth: 0,
    height: TRACK_H,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TRACK_H,
  },
  barCell: {
    width: STRIDE,
    height: TRACK_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bar: {
    width: BAR_W,
    borderRadius: 999,
  },
});
