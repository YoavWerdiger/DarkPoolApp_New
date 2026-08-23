import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { AcademySubScreenBar } from '../../components/learning';
import { ACADEMY_CARD_HP, academyCardWidth } from '../../components/learning/academyCardLayout';
import { ScreenChrome } from '../../components/ui';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type CourseComingSoonParams = {
  courseId: string;
  title?: string;
  subtitle?: string;
  coverUrl?: string;
};

const localOracleBanner = require('../../assets/oracle-course-banner.jpg');

export const CourseComingSoonScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as CourseComingSoonParams;
  const DesignTokens = useDesignTokens();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const title = (params.title || 'האורקל').trim();
  const subtitle = (params.subtitle || '').trim();
  const coverSource = params.coverUrl
    ? { uri: params.coverUrl }
    : localOracleBanner;

  const coverHeight = Math.round(academyCardWidth(screenWidth) * 0.52);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.35 + (pulse.value - 1) * 2.5,
  }));

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.flex} edges={['top']}>
        <AcademySubScreenBar onBackPress={handleBack} title={title} />

        <View style={styles.body}>
          <Animated.View entering={FadeIn.duration(420)} style={[styles.coverWrap, { height: coverHeight }]}>
            <Image source={coverSource} style={styles.coverImg} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(10,14,10,0.55)', 'rgba(10,14,10,0.96)']}
              locations={[0.15, 0.55, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { borderColor: DesignTokens.colors.border.accent }]}>
                <Text style={[styles.badgeText, { color: DesignTokens.colors.primary.main }]}>
                  Coming Soon
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(480)} style={styles.heroBlock}>
            <View style={styles.iconStage}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  { borderColor: DesignTokens.colors.primary.glow },
                  pulseStyle,
                ]}
              />
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: DesignTokens.colors.primary.dim,
                    borderColor: DesignTokens.colors.border.accent,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={34} color={DesignTokens.colors.primary.main} />
              </View>
            </View>

            <Text style={styles.headline}>בקרוב</Text>
            <Text style={styles.englishHint}>Coming Soon</Text>
            {subtitle ? (
              <Text style={styles.courseSubtitle} numberOfLines={3}>
                {subtitle}
              </Text>
            ) : null}
            <Text style={styles.copy}>
              אנחנו מסיימים ללטש את הקורס. בקרוב תוכלו להיכנס לשיעורים — עקבו אחרי עדכונים באקדמיה.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).duration(480)} style={styles.ctaWrap}>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: DesignTokens.colors.primary.main }]}
              onPress={handleBack}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="חזרה לאקדמיה"
            >
              <Text style={[styles.ctaText, { color: DesignTokens.colors.text.inverse }]}>
                חזרה לאקדמיה
              </Text>
              <Ionicons name="arrow-back" size={18} color={DesignTokens.colors.text.inverse} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    body: {
      flex: 1,
      paddingHorizontal: ACADEMY_CARD_HP,
      paddingBottom: tokens.spacing['2xl'],
    },
    coverWrap: {
      width: '100%',
      borderRadius: tokens.borderRadius['2xl'],
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.elevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.primary,
    },
    coverImg: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    badgeRow: {
      position: 'absolute',
      top: tokens.spacing.md,
      left: tokens.spacing.md,
      right: tokens.spacing.md,
      flexDirection: 'row-reverse',
    },
    badge: {
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: 6,
      borderRadius: tokens.borderRadius.full,
      borderWidth: 1,
      backgroundColor: 'rgba(10,14,10,0.72)',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700' as const,
      letterSpacing: 0.6,
    },
    heroBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: tokens.spacing.xl,
      paddingBottom: tokens.spacing.lg,
      gap: tokens.spacing.sm,
    },
    iconStage: {
      width: 96,
      height: 96,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.md,
    },
    pulseRing: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1.5,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headline: {
      fontSize: 40,
      fontWeight: '800' as const,
      color: tokens.colors.text.primary,
      letterSpacing: -0.8,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    englishHint: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: tokens.colors.primary.main,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: tokens.spacing.xs,
    },
    courseSubtitle: {
      fontSize: tokens.typography.bodySmall.size,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 22,
      paddingHorizontal: tokens.spacing.md,
      marginTop: tokens.spacing.xs,
    },
    copy: {
      marginTop: tokens.spacing.sm,
      fontSize: tokens.typography.bodySmall.size,
      color: tokens.colors.text.tertiary,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 22,
      paddingHorizontal: tokens.spacing.sm,
      maxWidth: 340,
    },
    ctaWrap: {
      paddingTop: tokens.spacing.md,
    },
    cta: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: tokens.spacing.sm,
      paddingVertical: 15,
      borderRadius: tokens.borderRadius['3xl'],
    },
    ctaText: {
      fontSize: tokens.typography.titleXs.size,
      fontWeight: '700' as const,
    },
  });
