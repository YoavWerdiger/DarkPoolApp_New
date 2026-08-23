import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, I18nManager, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../ui/UICard';
import { DesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 96, 300);

/**
 * האפליקציה מפעילה `I18nManager.forceRTL(true)` (ראה index.ts), ולכן `row` כבר מסודר
 * מימין לשמאל. שני הקבועים האלה מקבעים את המיקום הפיזי בלי תלות במצב ה-RTL.
 */
/** הילד הראשון מוצג בצד השמאלי הפיזי */
const ROW_FIRST_ON_LEFT = I18nManager.isRTL ? 'row-reverse' : 'row';
/** הילד הראשון מוצג בצד הימני הפיזי */
const ROW_FIRST_ON_RIGHT = I18nManager.isRTL ? 'row' : 'row-reverse';

interface OnboardingSwipeCardsProps {
  options: { label: string; value: string; emoji?: string }[];
  currentValue?: string;
  onValueChange: (value: string) => void;
}

/**
 * בחירת אפשרות במסכי onboarding: כרטיס אחד ממורכז בכל פעם, ניווט בחצים ובנקודות.
 * אין גלילה אופקית — לכן אין חישובי snap שיכולים לשבור את המרכוז.
 */
const OnboardingSwipeCards: React.FC<OnboardingSwipeCardsProps> = ({
  options,
  currentValue,
  onValueChange,
}) => {
  const initialIndex = currentValue ? options.findIndex((opt) => opt.value === currentValue) : -1;
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

  // הכרטיס המוצג הוא הבחירה בפועל, לכן מסנכרנים גם כשנכנסים בלי ערך קיים.
  useEffect(() => {
    if (initialIndex < 0 && options.length > 0) {
      onValueChange(options[0].value);
    }
  }, []);

  const changeCard = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= options.length || newIndex === currentIndex) return;

      setCurrentIndex(newIndex);
      onValueChange(options[newIndex].value);
      void HapticFeedback.selection();
    },
    [currentIndex, options, onValueChange]
  );

  const goToNext = useCallback(() => {
    changeCard(currentIndex + 1);
  }, [currentIndex, changeCard]);

  const goToPrevious = useCallback(() => {
    changeCard(currentIndex - 1);
  }, [currentIndex, changeCard]);

  const activeOption = options[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === options.length - 1;

  const renderArrow = (
    iconName: 'chevron-back' | 'chevron-forward',
    onPress: () => void,
    disabled: boolean
  ) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: disabled ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 200, 5, 0.12)',
        borderWidth: 1,
        borderColor: disabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 200, 5, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Ionicons name={iconName} size={26} color={disabled ? 'rgba(255, 255, 255, 0.3)' : '#00C805'} />
    </Pressable>
  );

  if (!activeOption) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {/* הכרטיס הממורכז */}
      <View style={{ marginBottom: 32 }}>
        <UICard
          variant="glass"
          padding="none"
          // ה-wrapper הפנימי של UICard חייב גובה מפורש, אחרת `height: '100%'` בתוכן לא נפתר
          contentContainerStyle={{ width: '100%', height: '100%' }}
          style={{
            width: CARD_WIDTH,
            aspectRatio: 1,
            borderRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* width/height ב-100% ולא flex — עם aspectRatio על הכרטיס, flex לא מקבל גובה */}
          <View
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
            }}
          >
            {activeOption.emoji ? (
              <Text
                style={{
                  fontSize: 64,
                  marginBottom: 20,
                  textShadowColor: 'rgba(0, 0, 0, 0.25)',
                  textShadowOffset: { width: 0, height: 4 },
                  textShadowRadius: 12,
                }}
              >
                {activeOption.emoji}
              </Text>
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(0, 200, 5, 0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                <Ionicons name="person" size={32} color={DesignTokens.colors.primary.main} />
              </View>
            )}

            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: '#FFFFFF',
                textAlign: 'center',
                lineHeight: 28,
                writingDirection: 'rtl',
                textShadowColor: 'rgba(0, 0, 0, 0.3)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }}
            >
              {activeOption.label}
            </Text>
          </View>
        </UICard>
      </View>

      {/* חצים: שמאל = הכרטיס הבא, ימין = הכרטיס הקודם (התקדמות בעברית היא שמאלה) */}
      <View
        style={{
          flexDirection: ROW_FIRST_ON_LEFT,
          alignItems: 'center',
          justifyContent: 'space-between',
          width: CARD_WIDTH,
          marginBottom: 24,
        }}
      >
        {renderArrow('chevron-back', goToNext, isLast)}
        {renderArrow('chevron-forward', goToPrevious, isFirst)}
      </View>

      {/* נקודות: האפשרות הראשונה מימין, ההתקדמות שמאלה */}
      <View
        style={{
          flexDirection: ROW_FIRST_ON_RIGHT,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {options.map((option, index) => {
          const isActive = index === currentIndex;
          return (
            <Pressable
              key={option.value}
              onPress={() => changeCard(index)}
              accessibilityRole="button"
              hitSlop={8}
              style={{
                width: isActive ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isActive
                  ? DesignTokens.colors.primary.main
                  : 'rgba(255, 255, 255, 0.2)',
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

export default OnboardingSwipeCards;
