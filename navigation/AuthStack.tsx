import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import TestRegistrationScreen from '../screens/Auth/TestRegistrationScreen';
import { useDesignTokens } from '../components/ui/DesignTokens';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  const DesignTokens = useDesignTokens();
  
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left',
        gestureDirection: 'horizontal',
        gestureEnabled: true,
        animationDuration: 400,
        contentStyle: {
          backgroundColor: DesignTokens.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="TestRegistration" component={TestRegistrationScreen} />
    </Stack.Navigator>
  );
} 