import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingProvider } from '../context/OnboardingContext';

// Import screens
import {
  OnboardingPhoneScreen,
  OnboardingVerificationScreen,
  OnboardingNameScreen,
  OnboardingDateOfBirthScreen,
  OnboardingInvestorTypeScreen,
  OnboardingRiskToleranceScreen,
  OnboardingInterestsScreen,
  OnboardingNotificationsScreen,
  OnboardingSecuritySetupScreen,
  OnboardingWelcomeCompleteScreen,
} from '../screens/Onboarding';

// Define navigation param list
export type OnboardingStackParamList = {
  OnboardingPhone: undefined;
  OnboardingVerification: undefined;
  OnboardingName: undefined;
  OnboardingDateOfBirth: undefined;
  OnboardingInvestorType: undefined;
  OnboardingRiskTolerance: undefined;
  OnboardingInterests: undefined;
  OnboardingNotifications: undefined;
  OnboardingSecurity: undefined;
  OnboardingComplete: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * OnboardingStack - Cash App Style Onboarding Flow
 * 
 * 10 מסכים בהשראת Cash App:
 * 1. Phone Entry - כניסה עם טלפון
 * 2. Verification - אימות OTP
 * 3. Name - שם מלא
 * 4. Date of Birth - תאריך לידה
 * 5. Investor Type - סוג משקיע (ייחודי ל-DarkPool)
 * 6. Risk Tolerance - סובלנות סיכון (אופציונלי)
 * 7. Interests - תחומי עניין
 * 8. Notifications - התראות (אופציונלי)
 * 9. Security Setup - PIN/ביומטריה (אופציונלי)
 * 10. Welcome Complete - סיום מוצלח
 * 
 * דוגמה:
 * ```tsx
 * import OnboardingStack from './navigation/OnboardingStack';
 * 
 * <OnboardingStack />
 * ```
 */
const OnboardingStack: React.FC = () => {
  return (
    <OnboardingProvider>
      <Stack.Navigator
        initialRouteName="OnboardingPhone"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Stack.Screen 
          name="OnboardingPhone" 
          component={OnboardingPhoneScreen}
          options={{
            gestureEnabled: false, // מסך ראשון - אין back
          }}
        />
        <Stack.Screen 
          name="OnboardingVerification" 
          component={OnboardingVerificationScreen} 
        />
        <Stack.Screen 
          name="OnboardingName" 
          component={OnboardingNameScreen} 
        />
        <Stack.Screen 
          name="OnboardingDateOfBirth" 
          component={OnboardingDateOfBirthScreen} 
        />
        <Stack.Screen 
          name="OnboardingInvestorType" 
          component={OnboardingInvestorTypeScreen} 
        />
        <Stack.Screen 
          name="OnboardingRiskTolerance" 
          component={OnboardingRiskToleranceScreen} 
        />
        <Stack.Screen 
          name="OnboardingInterests" 
          component={OnboardingInterestsScreen} 
        />
        <Stack.Screen 
          name="OnboardingNotifications" 
          component={OnboardingNotificationsScreen} 
        />
        <Stack.Screen 
          name="OnboardingSecurity" 
          component={OnboardingSecuritySetupScreen} 
        />
        <Stack.Screen 
          name="OnboardingComplete" 
          component={OnboardingWelcomeCompleteScreen}
          options={{
            gestureEnabled: false, // מסך סיום - אין back
          }}
        />
      </Stack.Navigator>
    </OnboardingProvider>
  );
};

export default OnboardingStack;
