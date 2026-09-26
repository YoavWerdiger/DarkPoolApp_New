import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Pressable,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { DesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  appFlowSubtitleStyle,
  appFlowTitleCompactStyle,
  appFlowTitleStyle,
} from '../ui/appType';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../ui/DayNavBlurButton';
import { useRegistrationExitOptional } from '../../hooks/useExitRegistration';

export type OnboardingDensity = 'focused' | 'compact';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  /** Omit on completion screens that render their own centered headline. */
  title?: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  showBack?: boolean;
  /** סגירה/יציאה מהרישום (X). כשמוגדר context — מוצג אוטומטית אלא אם false. */
  showClose?: boolean;
  onClose?: () => void;
  /** קישור טקסט מתחת לכותרת (למשל «יש לי חשבון»). */
  exitHint?: string;
  onExitHintPress?: () => void;
  scrollable?: boolean;
  /**
   * focused — Revolut-style: big title, generous air (single-task screens).
   * compact — denser header for multi-content screens (track / summary).
   */
  density?: OnboardingDensity;
  /** Sticky bottom CTA area (single Continue pattern). */
  footer?: React.ReactNode;
  showProgress?: boolean;
}

/** RTL: שלב 1 מימין — row-reverse ממלא את הסגמנטים מימין לשמאל */
const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 4 }}>
    <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
      {Array.from({ length: total }).map((_, index) => {
        const filled = index < current;
        return (
          <View
            key={index}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: filled
                ? DesignTokens.colors.primary.main
                : 'rgba(255,255,255,0.1)',
            }}
          />
        );
      })}
    </View>
  </View>
);

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
  showBack = false,
  showClose,
  onClose,
  exitHint,
  onExitHintPress,
  scrollable = false,
  density = 'focused',
  footer,
  showProgress = true,
}) => {
  const navigation = useNavigation<any>();
  const exitFromContext = useRegistrationExitOptional();
  const resolvedClose = onClose ?? exitFromContext ?? undefined;
  const shouldShowClose = (showClose ?? !!resolvedClose) && !!resolvedClose;
  const shouldShowBack = showBack && !!onBack;
  const hasTopBar = shouldShowClose || shouldShowBack;

  // מונע GO_BACK לא מטופל (Android / מחווה) כשאין היסטוריה באמצע רישום
  useFocusEffect(
    useCallback(() => {
      if (!exitFromContext && !onBack) return undefined;
      const onHardwareBack = () => {
        if (navigation.canGoBack()) {
          if (onBack) {
            onBack();
          } else {
            navigation.goBack();
          }
          return true;
        }
        if (resolvedClose) {
          void resolvedClose();
          return true;
        }
        if (onBack) {
          onBack();
          return true;
        }
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [exitFromContext, navigation, onBack, resolvedClose])
  );

  useEffect(() => {
    if (!exitFromContext) return undefined;
    return navigation.addListener('beforeRemove', (e: { data: { action: { type: string } }; preventDefault: () => void }) => {
      if (e.data.action.type !== 'GO_BACK') return;
      if (navigation.canGoBack()) return;
      e.preventDefault();
      if (resolvedClose) {
        void resolvedClose();
      }
    });
  }, [exitFromContext, navigation, resolvedClose]);

  const isFocused = density === 'focused';
  const hasHeader = !!title || !!subtitle;
  const Content = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? {
        showsVerticalScrollIndicator: false,
        contentContainerStyle: {
          flexGrow: 1,
          justifyContent: 'flex-start' as const,
          paddingBottom: footer ? 8 : 36,
        },
        keyboardShouldPersistTaps: 'handled' as const,
      }
    : { style: { flex: 1 } };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <LinearGradient
            colors={['rgba(0,0,0,0.28)', 'transparent', 'rgba(0,0,0,0.22)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <SafeAreaView style={{ flex: 1 }}>
            {hasTopBar ? (
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {shouldShowClose ? (
                  <DayNavBlurButton
                    onPress={() => {
                      void resolvedClose?.();
                    }}
                    size={HEADER_BACK_BTN_SIZE}
                    glassIntensity="subtle"
                    accessibilityLabel="יציאה מהרישום"
                  >
                    <Ionicons
                      name="close"
                      size={22}
                      color={DesignTokens.colors.text.primary}
                    />
                  </DayNavBlurButton>
                ) : (
                  <View style={{ width: HEADER_BACK_BTN_SIZE, height: HEADER_BACK_BTN_SIZE }} />
                )}
                {shouldShowBack ? (
                  <DayNavBlurButton
                    onPress={onBack}
                    size={HEADER_BACK_BTN_SIZE}
                    glassIntensity="subtle"
                    accessibilityLabel="חזרה"
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color={DesignTokens.colors.text.primary}
                    />
                  </DayNavBlurButton>
                ) : (
                  <View style={{ width: HEADER_BACK_BTN_SIZE, height: HEADER_BACK_BTN_SIZE }} />
                )}
              </View>
            ) : (
              <View style={{ height: 8 }} />
            )}

            {showProgress ? <ProgressBar current={currentStep} total={totalSteps} /> : null}

            <View style={{ flex: 1 }}>
              <Content {...contentProps}>
                <View
                  style={{
                    paddingHorizontal: 24,
                    paddingTop: hasTopBar ? (isFocused ? 20 : 14) : isFocused ? 28 : 20,
                    paddingBottom: footer ? 12 : 24,
                    flex: scrollable ? undefined : 1,
                  }}
                >
                  {hasHeader ? (
                    <View
                      style={{
                        marginBottom: APP_LAYOUT.sectionHeaderToContent,
                        width: '100%',
                        alignItems: 'stretch',
                      }}
                    >
                      {title ? (
                        <Text style={isFocused ? appFlowTitleStyle : appFlowTitleCompactStyle}>
                          {title}
                        </Text>
                      ) : null}
                      {subtitle ? (
                        <Text
                          style={[
                            appFlowSubtitleStyle,
                            exitHint ? { marginBottom: 10 } : null,
                          ]}
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                      {exitHint && onExitHintPress ? (
                        <Pressable
                          onPress={onExitHintPress}
                          accessibilityRole="button"
                          accessibilityLabel={exitHint}
                          hitSlop={8}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: '600',
                              color: DesignTokens.colors.primary.main,
                              textAlign: 'right',
                              writingDirection: 'rtl',
                            }}
                          >
                            {exitHint}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {children}
                </View>
              </Content>
            </View>

            {footer ? (
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 4,
                  paddingBottom: Platform.OS === 'ios' ? 4 : 10,
                }}
              >
                {footer}
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default OnboardingLayout;
