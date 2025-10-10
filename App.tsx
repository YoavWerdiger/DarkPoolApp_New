import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthStack from './navigation/AuthStack';
import MainTabs from './navigation/MainTabs';
import { View, ActivityIndicator, Text, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import "./global.css";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import { RegistrationProvider } from './context/RegistrationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScheduledUpdatesService from './services/scheduledUpdates';

const Stack = createNativeStackNavigator();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

const OnboardingWithProvider = () => (
  <RegistrationProvider>
    <OnboardingNavigator />
  </RegistrationProvider>
);

function AppContent() {
  const { user, isLoading } = useAuth();

  console.log('🎓 AppContent: Auth state:', { user: user?.id, isLoading });

  // אתחול עדכונים מתוזמנים
  useEffect(() => {
    // התחלת עדכונים מתוזמנים רק אחרי שהמשתמש מחובר
    if (user && !isLoading) {
      console.log('🚀 Starting scheduled updates for user:', user.id);
      ScheduledUpdatesService.startScheduledUpdates();
    }

    // ניקוי בעת סגירת האפליקציה
    return () => {
      console.log('⏹️ Stopping scheduled updates');
      ScheduledUpdatesService.stopScheduledUpdates();
    };
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
        <LinearGradient 
          colors={['rgba(0,230,84,0.08)', 'rgba(0,230,84,0.03)', 'rgba(0,230,84,0.05)']} 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1
          }}
          resizeMode="cover"
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingHorizontal: 32,
            paddingVertical: 24,
            borderRadius: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(0,230,84,0.2)'
          }}>
            <ActivityIndicator size="large" color="#00E654" />
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 16, 
              fontWeight: '500',
              marginTop: 16,
              textAlign: 'center'
            }}>
              טוען אפליקציה...
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, direction: 'ltr', backgroundColor: '#121212' }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <>
              <Stack.Screen name="Auth" component={AuthStack} />
              <Stack.Screen name="Onboarding" component={OnboardingWithProvider} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
