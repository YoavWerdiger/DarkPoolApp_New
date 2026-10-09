/**
 * תגי משתמש ליד שם: [וי כחול][דרגת ותק].
 * לא מצייר כלום בזמן טעינה / כשאין תגים. השורה ב-ltr מפורש — התגים תמיד משמאל לשם
 * (אחרי השם בסדר קריאה בעברית), בלי תלות בכיוון שבעץ.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDesignTokens } from '../DesignTokens';
import { useTheme } from '../../../context/ThemeContext';
import { HelpSheet } from '../HelpSheet';
import { useUserBadges } from '../../../hooks/useUserBadges';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { VerifiedBadge } from './VerifiedBadge';
import { RankAnimalIcon } from './RankAnimalIcon';
import { RankSheet } from './RankSheet';
import { rankColor, rankForPaidDays } from './userRank';

const HIT = { top: 8, bottom: 8, left: 4, right: 4 };

type Props = {
  userId: string | null | undefined;
  /** גודל אייקון — בערך גובה שורת השם פחות מעט */
  size?: number;
  /** false → בלי לחיצה (למשל בתוך שורה שכולה לחיצה) */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function UserBadges({ userId, size = 16, interactive = true, style }: Props) {
  const badges = useUserBadges(userId);
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const [rankOpen, setRankOpen] = useState(false);
  const [verifiedOpen, setVerifiedOpen] = useState(false);
  // נשאר mounted אחרי פתיחה ראשונה — שאנימציית הסגירה לא תיחתך
  const [rankMounted, setRankMounted] = useState(false);
  const [verifiedMounted, setVerifiedMounted] = useState(false);

  const openRank = useCallback(() => {
    void HapticFeedback.impactLight();
    setRankMounted(true);
    setRankOpen(true);
  }, []);
  const openVerified = useCallback(() => {
    void HapticFeedback.impactLight();
    setVerifiedMounted(true);
    setVerifiedOpen(true);
  }, []);

  if (!badges) return null;
  const rank = rankForPaidDays(badges.paidDays);
  if (!badges.isVerified && !rank) return null;

  const rankIcon = rank ? (
    <RankAnimalIcon
      animal={rank.animal}
      color={rankColor(rank.metal, isDarkMode, tokens.colors.text.tertiary)}
      size={size}
    />
  ) : null;
  const verifiedIcon = badges.isVerified ? <VerifiedBadge size={size} /> : null;

  return (
    <View
      style={[
        { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: Math.max(2, Math.round(size / 6)), flexShrink: 0 },
        style,
      ]}
    >
      {rankIcon ? (
        interactive ? (
          <Pressable onPress={openRank} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="דרגת ותק">
            <View>{rankIcon}</View>
          </Pressable>
        ) : (
          rankIcon
        )
      ) : null}
      {verifiedIcon ? (
        interactive ? (
          <Pressable onPress={openVerified} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="משתמש מאומת">
            <View>{verifiedIcon}</View>
          </Pressable>
        ) : (
          verifiedIcon
        )
      ) : null}
      {interactive && rank && rankMounted ? (
        <RankSheet visible={rankOpen} onClose={() => setRankOpen(false)} paidDays={badges.paidDays ?? 0} />
      ) : null}
      {interactive && badges.isVerified && verifiedMounted ? (
        <HelpSheet
          visible={verifiedOpen}
          onClose={() => setVerifiedOpen(false)}
          title="משתמש מאומת"
          body="הווי הכחול מסמן חשבון שזהותו אומתה על ידי צוות האפליקציה."
        />
      ) : null}
    </View>
  );
}

type NameRowProps = {
  userId: string | null | undefined;
  /** טקסט השם — כדאי flexShrink:1 כדי שיתקצר לפני התגים */
  children: React.ReactNode;
  size?: number;
  interactive?: boolean;
  /** יישור פיזי של השורה */
  align?: 'right' | 'left' | 'center';
  style?: StyleProp<ViewStyle>;
};

/** שם + תגים משמאלו */
export function UserNameRow({ userId, children, size, interactive, align = 'right', style }: NameRowProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          direction: 'ltr',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
          gap: 4,
          minWidth: 0,
        },
        style,
      ]}
    >
      <UserBadges userId={userId} size={size} interactive={interactive} />
      {React.Children.map(children, (child) =>
        React.isValidElement<{ style?: unknown }>(child)
          ? React.cloneElement(child, { style: [child.props.style, NAME_FIT] })
          : child
      )}
    </View>
  );
}

// השם ברוחב הטבעי שלו — סגנונות כותרת רבים (appCardTitleStyle) הם width:'100%',
// מה שדחף את התג לקצה השני של השורה במקום צמוד לשם
const NAME_FIT = { width: 'auto', alignSelf: 'auto', flexShrink: 1, minWidth: 0 } as const;

/** גודל תג לפי גובה שורת השם */
export function badgeSizeForLineHeight(lineHeight: number): number {
  return Math.max(12, Math.round(lineHeight * 0.78));
}

export default UserBadges;
