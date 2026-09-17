import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenGradientBackground } from '../VideoBackground';

type Props = {
  children: React.ReactNode;
  /**
   * @deprecated הוסר — שור־ודוב כבר לא ברקע מסכים. נשאר ל-API תאימות.
   */
  withBrandWatermark?: boolean;
  /** מודול Dark Pool — האפל רץ ב-LTR; מכריח RTL על תוכן המסך */
  rtl?: boolean;
};

/**
 * מעטפת מסך — גרדיאנט מלא (~70% שחור), כמו מסך הצ׳אט.
 */
export function ScreenChrome({ children, rtl }: Props) {
  return (
    <View
      style={[
        styles.root,
        rtl ? styles.rtlRoot : null,
      ]}
    >
      <ScreenGradientBackground style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111111',
  },
  rtlRoot: {
    direction: 'rtl',
  },
});
