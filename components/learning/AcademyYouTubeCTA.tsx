import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ACADEMY_CARD_RADIUS } from './academyCardLayout';

const channelAvatar = require('../../assets/youtube-channel-avatar.png');

const YOUTUBE_BRAND = '#FF0033';
const YOUTUBE_BRAND_DARK = '#B3001A';

/**
 * The YouTube channel URL the CTA opens. Update this value when the channel
 * handle changes — keep it here as a single source of truth so the marketing
 * link can be swapped without touching layout code.
 */
export const ACADEMY_YOUTUBE_URL = 'https://www.youtube.com/@Davidariele';

export interface AcademyYouTubeCTAProps {
  url?: string;
}

export const AcademyYouTubeCTA: React.FC<AcademyYouTubeCTAProps> = ({
  url = ACADEMY_YOUTUBE_URL,
}) => {
  const T = useDesignTokens();
  const styles = useMemo(() => createStyles(T), [T]);

  const handlePress = async () => {
    void HapticFeedback.impactLight();
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      /* noop */
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="מעבר לערוץ היוטיוב של דוד אריאל"
      >
        <BlurView tint="dark" intensity={55} style={StyleSheet.absoluteFill} />
        <View style={styles.glassOverlay} />
        <View style={styles.glassTopHighlight} />

        {/* רקע אמביינטי — זוהר אדום עדין שמרמז על מותג היוטיוב בלי להציף */}
        <LinearGradient
          colors={[
            'rgba(255, 0, 51, 0.18)',
            'rgba(255, 0, 51, 0.04)',
            'rgba(255, 0, 51, 0)',
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.content}>
          <View style={styles.textCol}>
            <Text style={styles.title}>רוצים לצפות בתוכן נוסף?</Text>
            <Text style={styles.subtitle}>
              היכנסו לערוץ היוטיוב שלנו לסרטונים חדשים, ניתוחים שבועיים והדרכות
            </Text>

            <View style={styles.ctaRow}>
              <View style={styles.cta}>
                <LinearGradient
                  colors={[YOUTUBE_BRAND, YOUTUBE_BRAND_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="logo-youtube" size={16} color="#fff" />
                <Text style={styles.ctaText}>מעבר לערוץ</Text>
              </View>
              <Ionicons
                name="chevron-back"
                size={18}
                color={T.colors.text.tertiary}
                style={styles.chevron}
              />
            </View>
          </View>

          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} pointerEvents="none" />
            <View style={styles.avatarRing}>
              <Image
                source={channelAvatar}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            </View>
            <View style={styles.youtubeBadge}>
              <Ionicons name="logo-youtube" size={14} color="#fff" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (T: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      paddingTop: 8,
      paddingBottom: 8,
    },
    card: {
      width: '100%',
      overflow: 'hidden',
      borderRadius: ACADEMY_CARD_RADIUS,
      borderWidth: 0,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.28,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 16,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    glassOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(12, 18, 14, 0.72)',
    },
    glassTopHighlight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    content: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      padding: 18,
      gap: 16,
    },
    avatarWrap: {
      width: 68,
      height: 68,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarGlow: {
      position: 'absolute',
      top: -8,
      left: -8,
      right: -8,
      bottom: -8,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 0, 51, 0.18)',
      ...Platform.select({
        ios: {
          shadowColor: YOUTUBE_BRAND,
          shadowOpacity: 0.55,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 14,
        },
      }),
    },
    avatarRing: {
      width: 68,
      height: 68,
      borderRadius: 34,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: '#0A0E0A',
    },
    avatarImg: {
      width: '100%',
      height: '100%',
    },
    youtubeBadge: {
      position: 'absolute',
      bottom: -2,
      left: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: YOUTUBE_BRAND,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#0A0E0A',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    textCol: {
      flex: 1,
      gap: 6,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: T.colors.text.primary,
      textAlign: 'right',
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: 13,
      color: T.colors.text.secondary,
      textAlign: 'right',
      lineHeight: 19,
    },
    ctaRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      marginTop: 10,
      gap: 8,
    },
    cta: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    ctaText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.3,
    },
    chevron: {
      opacity: 0.7,
    },
  });

export default AcademyYouTubeCTA;
