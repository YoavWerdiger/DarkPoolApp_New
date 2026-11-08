import i18n from '../../../lib/i18n';
/**
 * תג מפלגה לפוליטיקאים (QA 11.4): R אדום / D כחול / I אפור — בכרטיס ב«חקור» ובעמוד הפרופיל.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PartyCode } from '../utils/congressParty';

const PARTY_COLORS: Record<PartyCode, string> = {
  R: '#D93A3A',
  D: '#2F6FDB',
  I: '#7C7C84',
};

export function PartyTag({
  party,
  size = 'sm',
  style,
}: {
  party: PartyCode;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const label =
    party === 'R'
      ? i18n.t('auto.screens__DarkPool__components__PartyTag.s1')
      : party === 'D'
        ? i18n.t('auto.screens__DarkPool__components__PartyTag.s2')
        : i18n.t('auto.screens__DarkPool__components__PartyTag.s3');
  return (
    <View
      style={[styles.tag, size === 'md' && styles.tagMd, { backgroundColor: PARTY_COLORS[party] }, style]}
      accessibilityLabel={label}
    >
      <Text style={[styles.text, size === 'md' && styles.textMd]}>{party}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagMd: {
    minWidth: 26,
    height: 24,
    borderRadius: 7,
    paddingHorizontal: 6,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  textMd: {
    fontSize: 13,
    lineHeight: 16,
  },
});
