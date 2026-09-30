import React, { memo, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { SoftUI } from '../../../components/ui/softUiPalette';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { formatInsiderDisplayName } from '../utils/investorPlaceholder';
import { InvestorPortrait } from './InvestorPortrait';
import { hebrewText, ltrNameText } from '../utils/bidi';
import { DARK_POOL_TYPE } from '../darkPoolLayout';
import { EXPLORE_PROFILE_CARD } from '../utils/exploreGrid';

const HEBREW_LETTER = /[\u0590-\u05FF]/;

function isolateNumericRuns(text: string): string {
  return text.replace(/\d+(?:[.,]\d+)*/g, (run) => `\u2066${run}\u2069`);
}

/** תפקיד או שיוך — לא מונה עסקאות, לא «דיווח», לא מדד. */
function profileRole(subtitle: string | null | undefined, metric: string | null | undefined): string | null {
  const raw = subtitle?.trim() ?? '';
  if (!raw || raw === metric?.trim()) return null;
  if (raw === 'קונגרס' || raw === 'בכיר' || raw === 'פעילות אחרונה') return null;
  if (/^דיווח\b/.test(raw)) return null;
  if (/עסקאות|עוקב/.test(raw)) return null;
  return raw;
}

interface Props {
  person: ExplorePerson;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ExplorePortraitCard = memo(function ExplorePortraitCard({
  person,
  onPress,
  style,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { width: cardW, height: cardH } = EXPLORE_PROFILE_CARD;
  const displayName =
    person.kind === 'insider'
      ? formatInsiderDisplayName(person.name)
      : person.name;
  const nameIsLatin = displayName.trim().length > 0 && !HEBREW_LETTER.test(displayName);
  const role = profileRole(person.subtitle, person.metric);
  const roleIsLatin = !!role && !HEBREW_LETTER.test(role);

  const content = (
    <View
      style={[styles.card, { width: cardW, height: cardH }, style]}
    >
      <InvestorPortrait
        name={displayName}
        imageUrl={person.image_url}
        ticker={person.ticker}
        kind={person.kind}
        personId={person.id}
        layout="card"
        style={styles.bg}
        priority="high"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.94)']}
          locations={[0.08, 0.46, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.footer}
        >
          <Text
            style={[styles.name, nameIsLatin ? styles.nameLatin : styles.nameHebrew]}
            numberOfLines={2}
          >
            {nameIsLatin ? displayName : isolateNumericRuns(displayName)}
          </Text>
          {role ? (
            <Text
              style={[styles.role, roleIsLatin ? styles.roleLatin : null]}
              numberOfLines={1}
            >
              {roleIsLatin ? role : isolateNumericRuns(role)}
            </Text>
          ) : null}
        </LinearGradient>
      </InvestorPortrait>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.selection();
        onPress();
      }}
      style={({ pressed }) => pressed && { opacity: 0.92 }}
    >
      {content}
    </Pressable>
  );
});

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      borderRadius: tokens.borderRadius.xl,
      overflow: 'hidden',
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    bg: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    footer: {
      direction: 'ltr',
      alignItems: 'stretch',
      paddingHorizontal: 12,
      paddingBottom: 10,
      paddingTop: 72,
      gap: 0,
    },
    name: {
      width: '100%',
      fontSize: DARK_POOL_TYPE.cardBody.fontSize,
      lineHeight: DARK_POOL_TYPE.groupLabel.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      letterSpacing: DARK_POOL_TYPE.cardTitle.letterSpacing,
      color: '#fff',
      includeFontPadding: false,
    },
    nameLatin: {
      ...ltrNameText,
    },
    nameHebrew: {
      ...hebrewText,
    },
    role: {
      ...hebrewText,
      width: '100%',
      fontSize: DARK_POOL_TYPE.cardSubtitle.fontSize,
      lineHeight: DARK_POOL_TYPE.cardSubtitle.lineHeight,
      fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
      color: SoftUI.textSecondary,
      marginTop: -2,
      includeFontPadding: false,
    },
    roleLatin: {
      ...ltrNameText,
    },
  });
}
