import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LearningScreen from '../screens/Learning';
import { DesignTokens } from '../components/ui/DesignTokens';

export type LearningStackParamList = {
  LearningScreen: undefined;
};

const Stack = createNativeStackNavigator<LearningStackParamList>();

export default function LearningStack() {
  return (
    <Stack.Navigator
      initialRouteName="LearningScreen"
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: DesignTokens.colors.background.primary,
        },
      }}
    >
      <Stack.Screen 
        name="LearningScreen" 
        component={LearningScreen}
        options={{ title: 'קורסים' }}
      />
    </Stack.Navigator>
  );
}

