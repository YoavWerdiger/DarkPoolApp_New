import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Svg, { Path } from 'react-native-svg';
import {
  STORY_SCREEN_HEIGHT as H,
  STORY_SCREEN_WIDTH as W,
  storyAuthoredFrame,
} from './storyLayout';

/**
 * מדיה של סטורי — בלי שום אנימציה/שקיפות: מה שנטען מוצג באטימות מלאה מהפריים הראשון.
 * (הצופה הישן הסתיר את המדיה מאחורי ערכי Reanimated בתוך Modal — בפרודקשן iOS נשאר שקוף.)
 */

function frameStyle(content: string | null | undefined) {
  const f = storyAuthoredFrame(content);
  return f
    ? { position: 'absolute' as const, left: 0, top: f.top, width: W, height: f.height }
    : mediaStyles.full;
}

/* ── תמונה ── */
export function StoryImage({
  uri,
  content,
  onLoad,
  onError,
}: {
  uri: string;
  content: string | null | undefined;
  onLoad: () => void;
  onError: () => void;
}) {
  const authored = storyAuthoredFrame(content);
  return (
    // בלי key לפי סטורי: expo-image ממשיך להציג את התמונה הקודמת עד שהבאה מוכנה (בלי הבהוב שחור)
    <ExpoImage
      source={{ uri }}
      transition={0}
      // זיכרון בלבד — בלי שמירה בדיסק
      cachePolicy="memory"
      style={frameStyle(content)}
      // עם טקסט/ציור: cover במסגרת (כמו בעורך) — אחרת contain במסך מלא
      contentFit={authored ? 'cover' : 'contain'}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

/* ── וידאו (expo-video ישירות, בלי מעטפת expo-av) ── */
export function StoryVideo({
  uri,
  content,
  paused,
  onReady,
  onEnd,
  onError,
}: {
  uri: string;
  content: string | null | undefined;
  paused: boolean;
  /** durationMs = 0 כשהמשך לא ידוע */
  onReady: (durationMs: number) => void;
  onEnd: () => void;
  onError: () => void;
}) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    p.muted = false;
  });

  const onReadyRef = useRef(onReady);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onEndRef.current = onEnd;
  onErrorRef.current = onError;

  useEffect(() => {
    const ready = () => {
      const d = Number(player.duration);
      onReadyRef.current(Number.isFinite(d) && d > 0 ? d * 1000 : 0);
    };
    const statusSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') ready();
      else if (status === 'error') onErrorRef.current();
    });
    const endSub = player.addListener('playToEnd', () => onEndRef.current());
    // ייתכן שהנגן כבר מוכן לפני שהמאזין נרשם
    if (player.status === 'readyToPlay') ready();
    else if (player.status === 'error') onErrorRef.current();
    return () => {
      statusSub.remove();
      endSub.remove();
    };
  }, [player]);

  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch {
      /* הנגן שוחרר */
    }
  }, [paused, player]);

  return (
    <VideoView
      player={player}
      // בלי overflow:hidden (וידאו iOS נתקע בחיתוך) — רק מיקום וגודל המסגרת
      style={frameStyle(content)}
      contentFit="contain"
      nativeControls={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}

/* ── סטורי טקסט ── */
export function StoryTextCard({ content, backgroundColor }: { content: string | null; backgroundColor: string | null }) {
  return (
    <View style={[mediaStyles.textBg, { backgroundColor: backgroundColor || '#1B5E20' }]} pointerEvents="none">
      <Text style={mediaStyles.textContent}>{content || ''}</Text>
    </View>
  );
}

/* ── טקסט / אימוג׳י / ציור מעל המדיה (JSON ב-content) — זהה לצופה הקודם ── */
export function StoryOverlays({ content }: { content: string | null | undefined }) {
  if (!content) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const overlaysArr: any[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.overlays)
      ? parsed.overlays
      : [];
  const drawingsArr: any[] = Array.isArray(parsed?.drawings) ? parsed.drawings : [];
  if (overlaysArr.length === 0 && drawingsArr.length === 0) return null;

  const authoredW = typeof parsed?.canvasWidth === 'number' ? parsed.canvasWidth : W;
  const authoredH = typeof parsed?.canvasHeight === 'number' ? parsed.canvasHeight : H;
  // המדיה מוצגת ברוחב המסך ובמרכז — שטח המדיה הוא רוחב המסך × גובה המסגרת בקנה אחד
  const fit = W / authoredW;
  const mediaH = authoredH * fit;
  const mediaTop = (H - mediaH) / 2;

  return (
    <>
      {drawingsArr.length > 0 && (
        <Svg
          style={{ position: 'absolute', left: 0, top: mediaTop, width: W, height: mediaH }}
          pointerEvents="none"
          viewBox={`0 0 ${authoredW} ${authoredH}`}
        >
          {drawingsArr.map((p: any, idx: number) => (
            <Path
              key={idx}
              d={p.d || ''}
              stroke={p.color || '#fff'}
              strokeWidth={p.strokeWidth || 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
      )}

      {overlaysArr.map((o: any, idx: number) => {
        const isEmoji = o.type === 'emoji';
        const bgColor = isEmoji
          ? 'transparent'
          : o.bgStyle === 'solid'
            ? (o.color === '#FFFFFF' ? '#000000' : '#FFFFFF')
            : o.bgStyle === 'semi'
              ? 'rgba(0,0,0,0.45)'
              : 'transparent';
        const tx = (typeof o.x === 'number' ? o.x : 0) * fit;
        const ty = (typeof o.y === 'number' ? o.y : 0) * fit;
        const sc = (typeof o.scale === 'number' ? o.scale : 1) * fit;
        return (
          <View
            key={idx}
            style={{
              position: 'absolute',
              // כמו בעורך: מרכז המסגרת − 60 (בקנה של המסך)
              top: mediaTop + mediaH / 2 - 60 * fit,
              alignSelf: 'center',
              zIndex: 12,
              transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
            }}
            pointerEvents="none"
          >
            <View
              style={{
                backgroundColor: bgColor,
                borderRadius: !isEmoji && o.bgStyle !== 'none' ? 12 : 0,
                paddingHorizontal: !isEmoji && o.bgStyle !== 'none' ? 16 : 0,
                paddingVertical: !isEmoji && o.bgStyle !== 'none' ? 8 : 0,
                maxWidth: W * 0.85,
              }}
            >
              <Text
                style={{
                  color: isEmoji ? '#fff' : (o.color || '#fff'),
                  fontSize: o.fontSize || 28,
                  fontWeight: !isEmoji && o.bold ? '800' : '400',
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                {o.text}
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

const mediaStyles = StyleSheet.create({
  full: {
    ...StyleSheet.absoluteFill,
    width: W,
    height: H,
  },
  textBg: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  textContent: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
