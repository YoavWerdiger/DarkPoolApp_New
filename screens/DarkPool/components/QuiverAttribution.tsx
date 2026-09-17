/**
 * Attribution ל-Quiver + הסבר קצר על תדירות סנכרון ומקור הנתונים.
 * אין webhooks — משיכות מתוזמנות (pg_cron) לשרת; משיכה למטה באפליקציה מרעננת מה-DB.
 */

import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

const QUIVER_URL = 'https://www.quiverquant.com/';

export type DataFreshnessScope =
  | 'all'
  | 'congress'
  | 'insiders'
  | 'explore'
  | 'politician'
  | 'fund';

type Props = {
  /** הצג רק כשהנתונים רלוונטיים למסך */
  visible?: boolean;
  /** איזה מקור/פיד להסביר — ברירת מחדל: קישור Quiver בלבד */
  scope?: DataFreshnessScope | 'link-only';
};

const FRESHNESS_COPY: Record<
  DataFreshnessScope,
  { title: string; body: string }
> = {
  all: {
    title: 'עדכון נתונים · לא בזמן אמת',
    body: 'קונגרס: כל ~20 ד׳ מ־Quiver (STOCK Act + טראמפ trumpstocktrades). בכירים: 3× ביום מסחר (+ Form 4). משיכה למטה מרעננת מה-DB — לא מסנכרנת מ-Quiver.',
  },
  congress: {
    title: 'עדכון נתונים · כל ~20 דקות',
    body: 'מקור: Quiver — דיווחי STOCK Act לקונגרס; טראמפ מ־/beta/bulk/trumpstocktrades (לא BioGuide). סנכרון מתוזמן (אין webhook). משיכה למטה = מה שכבר נשמר אצלנו.',
  },
  insiders: {
    title: 'עדכון נתונים · 3× ביום מסחר',
    body: 'מקור ראשי Quiver (+ Form 4 / SEC). גם catch-up בסופ״ש. לא פיד חי — משיכה למטה מרעננת מה-DB.',
  },
  explore: {
    title: 'עדכון נתונים · משיכות מתוזמנות',
    body: 'עסקאות קונגרס כל ~20 ד׳ (+ טראמפ trumpstocktrades) · מטא־דאטה/אחזקות Quiver יומית (~06:15 UTC) · 13F קרנות פעם ביום. אין realtime.',
  },
  politician: {
    title: 'עדכון נתונים · לא שווי נטו חי',
    body: 'עסקאות מ־Quiver (~כל 20 ד׳; טראמפ = trumpstocktrades). תאריך ברשימה = Filed. אחזקות מוערכות מ־cache יומי. ביצועים משוערים מדיווחים ציבוריים.',
  },
  fund: {
    title: 'עדכון נתונים · דיווחי 13F',
    body: 'אחזקות קרנות מסונכרנות פעם ביום מ־Quiver (SEC 13F) — לא עסקאות יומיות.',
  },
};

export function QuiverAttribution({
  visible = true,
  scope = 'link-only',
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  if (!visible) return null;

  const copy = scope !== 'link-only' ? FRESHNESS_COPY[scope] : null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {copy ? (
        <>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </>
      ) : null}
      <Pressable
        onPress={() => {
          void Linking.openURL(QUIVER_URL);
        }}
        accessibilityRole="link"
        accessibilityLabel="Data provided by the Quiver API"
        hitSlop={6}
      >
        <Text style={styles.link}>Data provided by the Quiver API</Text>
      </Pressable>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      alignSelf: 'stretch',
      paddingVertical: 8,
      paddingHorizontal: 2,
      gap: 4,
    },
    title: {
      fontSize: 12,
      fontWeight: '700',
      color: tokens.colors.text.secondary,
      textAlign: 'left',
    },
    body: {
      fontSize: 11,
      lineHeight: 16,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
    },
    link: {
      marginTop: 2,
      fontSize: 11,
      color: tokens.colors.text.secondary,
      textDecorationLine: 'underline',
      textAlign: 'left',
      opacity: 0.85,
    },
  });
}
