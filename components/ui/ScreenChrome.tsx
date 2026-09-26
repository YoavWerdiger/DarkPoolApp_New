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
 * מעטפת מסך שקופה מעל האורורה בשורש.
 * `ScreenGradientBackground` לא מצייר שכבה שנייה כשהשורש כבר מארח AuroraHost.
 * `rtl` מכריח direction על שכבת התוכן (לא על שורש האפליקציה).
 * טקסט גוף צריך darkPoolPhysicalRightText — Yoga ממפה textAlign:'right'
 * ל-trailing (שמאל) כשההורה RTL.
 */
export function ScreenChrome({ children, rtl }: Props) {
  return (
    <View style={styles.root}>
      <ScreenGradientBackground style={StyleSheet.absoluteFill} />
      <View style={[styles.content, rtl ? styles.rtlContent : null]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  rtlContent: {
    direction: 'rtl',
  },
});
