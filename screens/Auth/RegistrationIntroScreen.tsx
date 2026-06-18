import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  ImageBackground,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { SUPABASE_URL } from '../../config/publicEnv';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width, height } = Dimensions.get('window');

// ─── Data ──────────────────────────────────────────────────────────────────
const marketOptions = [
  { label: '🇺🇸 מניות אמריקאיות', value: 'us_stocks' },
  { label: '🇮🇱 מניות ישראליות',  value: 'il_stocks' },
  { label: '₿ קריפטו',             value: 'crypto'   },
  { label: '💱 פורקס',             value: 'forex'    },
  { label: '⚙️ אופציות',           value: 'options'  },
  { label: '🪙 סחורות',            value: 'commodities' },
  { label: '📦 אחר',               value: 'other'    },
];

const experienceOptions = [
  { label: '< חצי שנה', value: '<0.5' },
  { label: '6 חודשים–2 שנים', value: '0.5-2' },
  { label: '2–5 שנים', value: '2-5' },
  { label: '5+ שנים', value: '5+' },
];

const fullTimeOptions = [
  { label: 'משרה מלאה', value: 'full' },
  { label: 'משרה חלקית', value: 'part' },
  { label: 'פסיבי', value: 'passive' },
];

const styleOptions = [
  { label: 'Day Trading', value: 'day' },
  { label: 'Swing', value: 'swing' },
  { label: 'Position', value: 'position' },
  { label: 'Scalping', value: 'scalping' },
  { label: 'אחר', value: 'other' },
];

// ─── Chip component ────────────────────────────────────────────────────────
interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
  const pressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();

  const handlePress = () => {
    void HapticFeedback.selection();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], margin: 4 }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 24,
          backgroundColor: selected
            ? DesignTokens.colors.primary.main
            : 'rgba(255,255,255,0.07)',
          borderWidth: 1.5,
          borderColor: selected
            ? DesignTokens.colors.primary.main
            : 'rgba(255,255,255,0.12)',
          shadowColor: selected ? DesignTokens.colors.primary.main : 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: selected ? 0.4 : 0,
          shadowRadius: 6,
          elevation: selected ? 4 : 0,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: selected ? '700' : '500',
            color: selected ? '#000' : 'rgba(255,255,255,0.8)',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Section wrapper ───────────────────────────────────────────────────────
const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={{ marginBottom: 28 }}>
    <Text
      style={{
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 10,
        textAlign: 'right',
        letterSpacing: 0.2,
      }}
    >
      {title}
    </Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', margin: -4 }}>
      {children}
    </View>
  </View>
);

// ─── Progress bar ──────────────────────────────────────────────────────────
const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 }}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor:
              i < current
                ? DesignTokens.colors.primary.main
                : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </View>
  </View>
);

// ─── Screen ────────────────────────────────────────────────────────────────
const RegistrationIntroScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();

  const [markets, setMarkets]   = useState<string[]>(data.markets   || []);
  const [experience, setExperience] = useState<string | null>(data.experience || null);
  const [fullTime, setFullTime]   = useState<string | null>(data.fullTime   || null);
  const [style, setStyle]         = useState<string | null>(data.style       || null);
  const [goals, setGoals]         = useState<string>(data.goals      || '');
  const [focused, setFocused]     = useState(false);


  useEffect(() => {
    // placeholder
  }, []);

  const toggleMarket = (value: string) => {
    setMarkets(prev =>
      prev.includes(value) ? prev.filter(m => m !== value) : [...prev, value]
    );
  };

  const handleNext = () => {
    setData({
      ...data,
      markets,
      experience: experience ?? '',
      fullTime: fullTime ?? '',
      style: style ?? '',
      goals,
      accountType: 'free',
    });
    navigation.navigate('RegistrationTrack');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#0A0E0A', '#0F1A0F', '#142014', '#0A0E0A']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Depth overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.35)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Bull & Bear background */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', opacity: 0.22 }}>
            <ImageBackground
              source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
              style={{ width: width * 1.6, height: height * 1.6 }}
              imageStyle={{ resizeMode: 'contain' }}
            />
          </View>

          {/* Animated candlestick chart */}

          <SafeAreaView style={{ flex: 1 }}>
            <ProgressBar current={3} total={5} />

            {/* Back button */}
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.impactLight();
                  navigation.goBack();
                }}
                activeOpacity={0.75}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'flex-end',
                }}
              >
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 48 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
                {/* Header */}
                <View style={{ marginBottom: 32 }}>
                  <Text
                    style={{
                      fontSize: 30,
                      fontWeight: '800',
                      color: '#fff',
                      marginBottom: 8,
                      letterSpacing: -0.5,
                      textAlign: 'right',
                    }}
                  >
                    הכר את עצמך
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.55)',
                      textAlign: 'right',
                      lineHeight: 22,
                    }}
                  >
                    ספר לנו על הניסיון והמטרות שלך
                  </Text>
                </View>

                {/* Markets – multi select */}
                <Section title="שווקים מעניינים">
                  {marketOptions.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={markets.includes(opt.value)}
                      onPress={() => toggleMarket(opt.value)}
                    />
                  ))}
                </Section>

                {/* Experience – single */}
                <Section title="ניסיון בסחר">
                  {experienceOptions.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={experience === opt.value}
                      onPress={() => setExperience(opt.value)}
                    />
                  ))}
                </Section>

                {/* Full time – single */}
                <Section title="סטטוס סחר">
                  {fullTimeOptions.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={fullTime === opt.value}
                      onPress={() => setFullTime(opt.value)}
                    />
                  ))}
                </Section>

                {/* Style – single */}
                <Section title="סגנון סחר">
                  {styleOptions.map(opt => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={style === opt.value}
                      onPress={() => setStyle(opt.value)}
                    />
                  ))}
                </Section>

                {/* Goals – text */}
                <View style={{ marginBottom: 28 }}>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: 13,
                      fontWeight: '500',
                      marginBottom: 10,
                      textAlign: 'right',
                    }}
                  >
                    מטרות (אופציונלי)
                  </Text>
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: focused
                        ? DesignTokens.colors.primary.main
                        : 'rgba(255,255,255,0.1)',
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <TextInput
                      style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: '400',
                        textAlign: 'right',
                        minHeight: 72,
                        textAlignVertical: 'top',
                      }}
                      placeholder="ספר לנו על המטרות שלך..."
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      value={goals}
                      onChangeText={setGoals}
                      multiline
                      numberOfLines={4}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                    />
                  </View>
                </View>

                {/* Primary CTA */}
                <LinearGradient
                  colors={['#00C805', '#00A004', '#008F03']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 30,
                    shadowColor: DesignTokens.colors.primary.main,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    elevation: 8,
                    marginBottom: 4,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.medium();
                      handleNext();
                    }}
                    activeOpacity={0.85}
                    style={{ paddingVertical: 17, alignItems: 'center' }}
                  >
                    <Text
                      style={{
                        color: '#000',
                        fontSize: 16,
                        fontWeight: '700',
                        letterSpacing: 0.3,
                      }}
                    >
                      המשך
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationIntroScreen;
