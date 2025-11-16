import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DropDownPicker from 'react-native-dropdown-picker';
import { DesignTokens } from '../../components/ui/DesignTokens';

const marketOptions = [
  { label: '🇺🇸 מניות אמריקאיות', value: 'us_stocks' },
  { label: '🇮🇱 מניות ישראליות', value: 'il_stocks' },
  { label: 'קריפטו', value: 'crypto' },
  { label: 'פורקס', value: 'forex' },
  { label: 'אופציות', value: 'options' },
  { label: 'סחורות', value: 'commodities' },
  { label: 'אחר', value: 'other' },
];

const experienceOptions = [
  { label: 'פחות מחצי שנה', value: '<0.5' },
  { label: '0.5–2 שנים', value: '0.5-2' },
  { label: '2–5 שנים', value: '2-5' },
  { label: '5+ שנים', value: '5+' },
];

const fullTimeOptions = [
  { label: 'סוחר במשרה מלאה', value: 'full' },
  { label: 'סוחר במשרה חלקית', value: 'part' },
  { label: 'משקיע פסיבי / לא סוחר יומיומי', value: 'passive' },
];

const styleOptions = [
  { label: 'Day Trading', value: 'day' },
  { label: 'Swing Trading', value: 'swing' },
  { label: 'Position Trading', value: 'position' },
  { label: 'Scalping', value: 'scalping' },
  { label: 'אחר', value: 'other' },
];

const RegistrationIntroScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  
  // State for dropdowns
  const [markets, setMarkets] = useState(data.markets || []);
  const [experience, setExperience] = useState(data.experience || null);
  const [fullTime, setFullTime] = useState(data.fullTime || null);
  const [style, setStyle] = useState(data.style || null);
  const [goals, setGoals] = useState(data.goals || '');
  
  // Dropdown states
  const [marketOpen, setMarketOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [fullTimeOpen, setFullTimeOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

  const handleNext = () => {
    setData({
      ...data,
      markets,
      experience,
      fullTime,
      style,
      goals
    });
    navigation.navigate('RegistrationPayment');
  };

  const { width, height } = Dimensions.get('window');

  // Create subtle background pattern
  const createBackgroundPattern = () => {
    const patterns = [];
    for (let i = 0; i < 15; i++) {
      patterns.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.05 + 0.02
      });
    }
    return patterns;
  };

  const backgroundPattern = createBackgroundPattern();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#000000', '#0d1b0d', '#1a2d1a', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Subtle Background Pattern */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {backgroundPattern.map((dot, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: dot.x,
                  top: dot.y,
                  width: dot.size,
                  height: dot.size,
                  backgroundColor: DesignTokens.colors.primary.main,
                  opacity: dot.opacity,
                  borderRadius: dot.size / 2
                }}
              />
            ))}
          </View>

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Transparent Background Image - Center */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.15
          }}>
            <ImageBackground
              source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
              style={{
                width: width,
                height: height,
                resizeMode: 'contain'
              }}
              imageStyle={{
                opacity: 0.3
              }}
            />
          </View>

          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
              {/* Header Section */}
              <View style={{ alignItems: 'center', marginBottom: 40 }}>
                {/* Main Title */}
                <Text style={{ 
                  fontSize: 32, 
                  fontWeight: '800', 
                  color: DesignTokens.colors.text.primary, 
                  marginBottom: 8,
                  letterSpacing: -0.8,
                  textAlign: 'center',
                  writingDirection: 'rtl'
                }}>
                  הכר את עצמך
                </Text>
                
                {/* Subtitle */}
                <Text style={{ 
                  fontSize: 16, 
                  color: DesignTokens.colors.text.secondary, 
                  fontWeight: '400',
                  letterSpacing: 0.3,
                  textAlign: 'center',
                  lineHeight: 22,
                  writingDirection: 'rtl'
                }}>
                  ספר לנו על הניסיון והמטרות שלך
                </Text>
                
                {/* Decorative Line */}
                <View style={{
                  width: 60,
                  height: 2,
                  backgroundColor: DesignTokens.colors.primary.main,
                  marginTop: 16,
                  borderRadius: 1
                }} />
              </View>

              {/* Form Section */}
              <View style={{ gap: 20 }}>
                {/* Markets Selection */}
                <View>
                  <Text style={{ 
                    color: DesignTokens.colors.text.primary, 
                    fontSize: 14, 
                    fontWeight: '600', 
                    marginBottom: 8,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    textAlign: 'right'
                  }}>
                    שווקים מעניינים
                  </Text>
                  <View style={{
                    backgroundColor: DesignTokens.colors.background.secondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.border.main,
                    paddingHorizontal: 16,
                    paddingVertical: 4
                  }}>
      <DropDownPicker
                      open={marketOpen}
        value={markets}
                      items={marketOptions}
                      setOpen={setMarketOpen}
        setValue={setMarkets}
        multiple={true}
                      placeholder="בחר שווקים"
                      placeholderStyle={{ color: DesignTokens.colors.text.tertiary, textAlign: 'right' }}
        style={{
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        minHeight: 48
                      }}
                      textStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 16,
                        fontWeight: '500',
                        textAlign: 'right'
        }}
        dropDownContainerStyle={{
                        backgroundColor: DesignTokens.colors.background.secondary,
                        borderColor: DesignTokens.colors.border.main,
                        borderWidth: 1.5,
                        borderRadius: 14
                      }}
                      listItemLabelStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 14,
                        textAlign: 'right'
                      }}
                      selectedItemLabelStyle={{
                        color: DesignTokens.colors.primary.main,
                        fontWeight: '600'
                      }}
                      tickIconStyle={{
                        tintColor: '#00E654'
                      }}
                    />
                  </View>
                </View>

                {/* Experience */}
                <View>
                  <Text style={{ 
                    color: DesignTokens.colors.text.primary, 
                    fontSize: 14, 
                    fontWeight: '600', 
                    marginBottom: 8,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    textAlign: 'right'
                  }}>
                    ניסיון בסחר
                  </Text>
                  <View style={{
                    backgroundColor: DesignTokens.colors.background.secondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.border.main,
                    paddingHorizontal: 16,
                    paddingVertical: 4
                  }}>
      <DropDownPicker
        open={experienceOpen}
        value={experience}
                      items={experienceOptions}
        setOpen={setExperienceOpen}
        setValue={setExperience}
                      placeholder="בחר ניסיון"
                      placeholderStyle={{ color: DesignTokens.colors.text.tertiary, textAlign: 'right' }}
        style={{
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        minHeight: 48
                      }}
                      textStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 16,
                        fontWeight: '500',
                        textAlign: 'right'
        }}
        dropDownContainerStyle={{
                        backgroundColor: DesignTokens.colors.background.secondary,
                        borderColor: DesignTokens.colors.border.main,
                        borderWidth: 1.5,
                        borderRadius: 14
                      }}
                      listItemLabelStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 14,
                        textAlign: 'right'
                      }}
                      selectedItemLabelStyle={{
                        color: DesignTokens.colors.primary.main,
                        fontWeight: '600'
                      }}
                      tickIconStyle={{
                        tintColor: '#00E654'
                      }}
                    />
                  </View>
                </View>

                {/* Full Time */}
                <View>
                  <Text style={{ 
                    color: DesignTokens.colors.text.primary, 
                    fontSize: 14, 
                    fontWeight: '600', 
                    marginBottom: 8,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    textAlign: 'right'
                  }}>
                    סטטוס סחר
                  </Text>
                  <View style={{
                    backgroundColor: DesignTokens.colors.background.secondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.border.main,
                    paddingHorizontal: 16,
                    paddingVertical: 4
                  }}>
      <DropDownPicker
        open={fullTimeOpen}
        value={fullTime}
                      items={fullTimeOptions}
        setOpen={setFullTimeOpen}
        setValue={setFullTime}
                      placeholder="בחר סטטוס"
                      placeholderStyle={{ color: DesignTokens.colors.text.tertiary, textAlign: 'right' }}
        style={{
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        minHeight: 48
        }}
        textStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 16,
                        fontWeight: '500',
                        textAlign: 'right'
        }}
        dropDownContainerStyle={{
                        backgroundColor: DesignTokens.colors.background.secondary,
                        borderColor: DesignTokens.colors.border.main,
                        borderWidth: 1.5,
                        borderRadius: 14
                      }}
                      listItemLabelStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 14,
                        textAlign: 'right'
                      }}
                      selectedItemLabelStyle={{
                        color: DesignTokens.colors.primary.main,
                        fontWeight: '600'
                      }}
                      tickIconStyle={{
                        tintColor: '#00E654'
                      }}
      />
    </View>
                </View>

                {/* Trading Style */}
                <View>
                  <Text style={{ 
                    color: DesignTokens.colors.text.primary, 
                    fontSize: 14, 
                    fontWeight: '600', 
                    marginBottom: 8,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    textAlign: 'right'
                  }}>
                    סגנון סחר
                  </Text>
                  <View style={{
                    backgroundColor: DesignTokens.colors.background.secondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.border.main,
                    paddingHorizontal: 16,
                    paddingVertical: 4
                  }}>
      <DropDownPicker
                      open={styleOpen}
                      value={style}
                      items={styleOptions}
                      setOpen={setStyleOpen}
                      setValue={setStyle}
                      placeholder="בחר סגנון"
                      placeholderStyle={{ color: DesignTokens.colors.text.tertiary, textAlign: 'right' }}
        style={{
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        minHeight: 48
        }}
        textStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 16,
                        fontWeight: '500',
                        textAlign: 'right'
        }}
        dropDownContainerStyle={{
                        backgroundColor: DesignTokens.colors.background.secondary,
                        borderColor: DesignTokens.colors.border.main,
                        borderWidth: 1.5,
                        borderRadius: 14
                      }}
                      listItemLabelStyle={{
                        color: DesignTokens.colors.text.primary,
                        fontSize: 14,
                        textAlign: 'right'
                      }}
                      selectedItemLabelStyle={{
                        color: DesignTokens.colors.primary.main,
                        fontWeight: '600'
                      }}
                      tickIconStyle={{
                        tintColor: '#00E654'
                      }}
      />
    </View>
                </View>

                {/* Goals */}
                <View>
                  <Text style={{ 
                    color: DesignTokens.colors.text.primary, 
                    fontSize: 14, 
                    fontWeight: '600', 
                    marginBottom: 8,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    textAlign: 'right'
                  }}>
                    מטרות
                  </Text>
                  <View style={{
                    backgroundColor: DesignTokens.colors.background.secondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.border.main,
          paddingHorizontal: 16, 
                    paddingVertical: 4
                  }}>
      <TextInput
        style={{ 
                        color: DesignTokens.colors.text.primary,
                        paddingVertical: 16,
                        fontSize: 16,
                        fontWeight: '500',
          textAlign: 'right',
                        minHeight: 80,
                        textAlignVertical: 'top'
                      }}
                      placeholder="ספר לנו על המטרות שלך..."
                      placeholderTextColor={DesignTokens.colors.text.tertiary}
                      value={goals}
                      onChangeText={setGoals}
                      multiline
                      numberOfLines={4}
      />
    </View>
                </View>

                {/* Next Button */}
                <LinearGradient
                  colors={['#00E654', '#00B84A', '#008F3A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 14,
                    marginTop: 12,
                    shadowColor: DesignTokens.colors.primary.main,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8
                  }}
                >
                <TouchableOpacity
                  onPress={handleNext}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ 
                      color: DesignTokens.colors.background.primary, 
                      fontSize: 16, 
                      fontWeight: '700',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      writingDirection: 'rtl'
                    }}>
                      המשך
                    </Text>
                </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationIntroScreen; 