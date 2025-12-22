import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRegistration } from '../../context/RegistrationContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

const { width, height } = Dimensions.get('window');

// Step Indicators Component
const StepIndicators = ({ current, total }: { current: number; total: number }) => (
  <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' }}>
    <View style={{
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8
    }}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index + 1 === current ? 28 : 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: index + 1 <= current 
              ? DesignTokens.colors.primary.main 
              : 'rgba(255,255,255,0.15)'
          }}
        />
      ))}
    </View>
    <Text style={{
      color: DesignTokens.colors.text.tertiary,
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: 10
    }}>
      שלב {current} מתוך {total}
    </Text>
  </View>
);

const RegistrationIntroScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  
  const [markets, setMarkets] = useState(data.markets || []);
  const [experience, setExperience] = useState(data.experience || null);
  const [fullTime, setFullTime] = useState(data.fullTime || null);
  const [style, setStyle] = useState(data.style || null);
  const [goals, setGoals] = useState(data.goals || '');
  
  const [marketOpen, setMarketOpen] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
  const [fullTimeOpen, setFullTimeOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

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

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = () => {
    setData({
      ...data,
      markets,
      experience,
      fullTime,
      style,
      goals,
      accountType: 'free'
    });
    navigation.navigate('RegistrationTrack');
  };

  const dropdownStyle = {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderWidth: 0,
    minHeight: 48
  };

  const dropdownContainerStyle = {
    backgroundColor: DesignTokens.colors.background.secondary,
    borderColor: DesignTokens.colors.border.main,
    borderWidth: 1.5,
    borderRadius: 14
  };

  const textStyle = {
    color: DesignTokens.colors.text.primary,
    fontSize: 16,
    fontWeight: '500' as const,
    textAlign: 'right' as const
  };

  const placeholderStyle = {
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'right' as const
  };

  const listItemLabelStyle = {
    color: DesignTokens.colors.text.primary,
    fontSize: 14,
    textAlign: 'right' as const
  };

  const selectedItemLabelStyle = {
    color: DesignTokens.colors.primary.main,
    fontWeight: '600' as const
  };

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

          {/* Transparent Background Image */}
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
            {/* Step Indicators */}
            <StepIndicators current={3} total={5} />
            
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
                {/* Back Button */}
                <TouchableOpacity
                  onPress={handleBack}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-end',
                    marginBottom: 16
                  }}
                >
                  <Text style={{
                    color: DesignTokens.colors.text.secondary,
                    fontSize: 16,
                    marginLeft: 4
                  }}>
                    חזרה
                  </Text>
                  <Ionicons name="chevron-forward" size={24} color={DesignTokens.colors.text.primary} />
                </TouchableOpacity>
                
                {/* Header Section */}
                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                  <Text style={{ 
                    fontSize: 32, 
                    fontWeight: '800', 
                    color: DesignTokens.colors.text.primary, 
                    marginBottom: 8,
                    letterSpacing: -0.8,
                    textAlign: 'center'
                  }}>
                    הכר את עצמך
                  </Text>
                  
                  <Text style={{ 
                    fontSize: 16, 
                    color: DesignTokens.colors.text.secondary, 
                    fontWeight: '400',
                    letterSpacing: 0.3,
                    textAlign: 'center',
                    lineHeight: 22
                  }}>
                    ספר לנו על הניסיון והמטרות שלך
                  </Text>
                  
                  <View style={{
                    width: 60,
                    height: 2,
                    backgroundColor: DesignTokens.colors.primary.main,
                    marginTop: 16,
                    borderRadius: 1
                  }} />
                </View>

                {/* Form Section */}
                <View style={{ gap: 20, zIndex: 1000 }}>
                  {/* Markets Selection */}
                  <View style={{ zIndex: 5000 }}>
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
                        placeholderStyle={placeholderStyle}
                        style={dropdownStyle}
                        textStyle={textStyle}
                        dropDownContainerStyle={dropdownContainerStyle}
                        listItemLabelStyle={listItemLabelStyle}
                        selectedItemLabelStyle={selectedItemLabelStyle}
                        tickIconStyle={{ tintColor: '#00E654' }}
                        listMode="MODAL"
                        modalTitle="בחר שווקים"
                        modalAnimationType="slide"
                      />
                    </View>
                  </View>

                  {/* Experience */}
                  <View style={{ zIndex: 4000 }}>
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
                        placeholderStyle={placeholderStyle}
                        style={dropdownStyle}
                        textStyle={textStyle}
                        dropDownContainerStyle={dropdownContainerStyle}
                        listItemLabelStyle={listItemLabelStyle}
                        selectedItemLabelStyle={selectedItemLabelStyle}
                        tickIconStyle={{ tintColor: '#00E654' }}
                        listMode="MODAL"
                        modalTitle="בחר ניסיון"
                        modalAnimationType="slide"
                      />
                    </View>
                  </View>

                  {/* Full Time */}
                  <View style={{ zIndex: 3000 }}>
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
                        placeholderStyle={placeholderStyle}
                        style={dropdownStyle}
                        textStyle={textStyle}
                        dropDownContainerStyle={dropdownContainerStyle}
                        listItemLabelStyle={listItemLabelStyle}
                        selectedItemLabelStyle={selectedItemLabelStyle}
                        tickIconStyle={{ tintColor: '#00E654' }}
                        listMode="MODAL"
                        modalTitle="בחר סטטוס"
                        modalAnimationType="slide"
                      />
                    </View>
                  </View>

                  {/* Trading Style */}
                  <View style={{ zIndex: 2000 }}>
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
                        placeholderStyle={placeholderStyle}
                        style={dropdownStyle}
                        textStyle={textStyle}
                        dropDownContainerStyle={dropdownContainerStyle}
                        listItemLabelStyle={listItemLabelStyle}
                        selectedItemLabelStyle={selectedItemLabelStyle}
                        tickIconStyle={{ tintColor: '#00E654' }}
                        listMode="MODAL"
                        modalTitle="בחר סגנון"
                        modalAnimationType="slide"
                      />
                    </View>
                  </View>

                  {/* Goals */}
                  <View style={{ zIndex: 1000 }}>
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
                        textTransform: 'uppercase'
                      }}>
                        המשך
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationIntroScreen;
