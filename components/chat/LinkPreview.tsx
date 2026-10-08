// ============================================
// Link Preview Component
// ============================================
// תצוגה מקדימה לקישור בהודעת צ'אט — כרטיס בסגנון iMessage/WhatsApp:
// תמונה גדולה למעלה (אם יש), כותרת, תיאור ודומיין. בלי תמונה — שורה קומפקטית עם אייקון האתר.
// הצבעים נגזרים מצבע הטקסט של הבועה — עובד בבועה שלי ושל אחר, בבהיר ובכהה.
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { openBrowserAsync } from '../../lib/expoWebBrowserSafe';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

// ----------- URL utils -----------

export function extractFirstUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"[\]{}|\\^`]+/gi;
  const match = text.match(urlRegex);
  if (!match) return null;
  const url = match[0].replace(/[.,;:!?)\]]+$/, ''); // סימני פיסוק בסוף
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const HEBREW_RE = /[֐-׿]/;
const alignFor = (text: string | null | undefined): 'right' | 'left' =>
  text && HEBREW_RE.test(text) ? 'right' : 'left';

// ----------- OG data (cached) -----------

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
}

const ogCache = new Map<string, OgData>();
const inflight = new Map<string, Promise<OgData>>();

function fetchOgData(url: string): Promise<OgData> {
  const cached = ogCache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(url);
  if (pending) return pending;

  const domain = extractDomain(url);
  const fallback: OgData = { title: null, description: null, image: null, domain };
  const run = (async () => {
    try {
      const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=true&palette=false`;
      const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) return fallback;
      const json = await res.json();
      if (json.status !== 'success' || !json.data) return fallback;
      const d = json.data;
      return {
        title: d.title || null,
        description: d.description || null,
        image: d.image?.url || null,
        domain,
      };
    } catch {
      return fallback;
    }
  })().then((data) => {
    ogCache.set(url, data);
    inflight.delete(url);
    return data;
  });
  inflight.set(url, run);
  return run;
}

// ----------- Component -----------

interface LinkPreviewProps {
  url: string;
  isMe: boolean;
  /** לונג-פרס על הכרטיס = תפריט ההודעה, כמו בשאר הבועה */
  onLongPress?: () => void;
}

export default function LinkPreview({ url, isMe, onLongPress }: LinkPreviewProps) {
  const tokens = useDesignTokens();
  const [og, setOg] = useState<OgData | null>(() => ogCache.get(url) ?? null);
  const mountedRef = useRef(true);
  const domain = extractDomain(url);

  useEffect(() => {
    mountedRef.current = true;
    if (!ogCache.has(url)) {
      setOg(null);
      void fetchOgData(url).then((data) => {
        if (mountedRef.current) setOg(data);
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, [url]);

  // צבע הטקסט של הבועה — ממנו נגזרים הרקע והקווים של הכרטיס
  const ink = isMe ? tokens.colors.bubbleMeText : tokens.colors.text.primary;
  const secondary = isMe ? tokens.colors.bubbleMeMetaText : tokens.colors.text.secondary;
  const loading = og === null;
  const hasImage = !!og?.image;
  const title = og?.title ?? null;

  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.selection();
        openBrowserAsync(url).catch(() => {});
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={title ? `${title}, ${domain}` : domain}
    >
      {/* רקע = צבע הטקסט בשקיפות נמוכה → מתאים לכל בועה ולכל ערכת נושא */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink, opacity: 0.07 }]} />

      {hasImage ? (
        <ExpoImage
          source={{ uri: og!.image! }}
          style={styles.hero}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={160}
        />
      ) : null}

      <View style={[styles.body, !hasImage && styles.bodyRow]}>
        {!hasImage ? (
          <View style={styles.iconTile}>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ink, opacity: 0.08, borderRadius: 8 }]} />
            <ExpoImage
              source={{ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=64` }}
              style={styles.favicon}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        ) : null}

        <View style={styles.textCol}>
          {loading ? (
            <>
              <View style={[styles.skelLine, { backgroundColor: ink, width: '78%' }]} />
              <View style={[styles.skelLine, styles.skelShort, { backgroundColor: ink, width: '46%' }]} />
            </>
          ) : (
            <>
              {title ? (
                <Text style={[styles.title, { color: ink, textAlign: alignFor(title) }]} numberOfLines={2}>
                  {title}
                </Text>
              ) : null}
              {og?.description && hasImage ? (
                <Text
                  style={[styles.description, { color: secondary, textAlign: alignFor(og.description) }]}
                  numberOfLines={2}
                >
                  {og.description}
                </Text>
              ) : null}
              <Text
                style={[styles.domain, { color: secondary }, !title && { color: ink }]}
                numberOfLines={1}
              >
                {domain}
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const CARD_W = 252;

const styles = StyleSheet.create({
  // רוחב קבוע (כמו וואטסאפ): לבועה אין רוחב משלה (נקבע מהתוכן), ולכן stretch + תמונה ב-100%
  // ויחס קבוע יצרו לולאה ב-Yoga → כרטיס ענק שכיסה את הצ׳אט
  card: {
    marginTop: 8,
    width: CARD_W,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.8,
  },
  hero: {
    width: CARD_W,
    height: Math.round(CARD_W / 1.91),
  },
  body: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  bodyRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 10,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  favicon: {
    width: 22,
    height: 22,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: '600',
  },
  description: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
  },
  domain: {
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    fontWeight: '500',
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    opacity: 0.12,
    marginVertical: 3,
  },
  skelShort: {
    height: 8,
  },
});
