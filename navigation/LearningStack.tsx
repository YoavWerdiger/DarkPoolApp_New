import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LearningScreen from '../screens/Learning';
import { CoursesScreen } from '../screens/Learning/CoursesScreen';
import { CourseDetailScreen } from '../screens/Learning/CourseDetailScreen';
import { CoursePreviewScreen } from '../screens/Learning/CoursePreviewScreen';
import { MyNotesScreen } from '../screens/Learning/MyNotesScreen';
import { useDesignTokens } from '../components/ui/DesignTokens';

export type LearningStackParamList = {
  CoursesScreen: undefined;
  LearningScreen: { courseId?: string; lessonId?: string };
  CourseDetailScreen: { courseId: string };
  CoursePreviewScreen: { youtubeLinks?: string[] };
  MyNotesScreen: undefined;
};

const Stack = createNativeStackNavigator<LearningStackParamList>();

export default function LearningStack() {
  const DesignTokens = useDesignTokens();
  
  return (
    <Stack.Navigator
      initialRouteName="CoursesScreen"
      screenOptions={{
        headerShown: false,
        cardStyle: {
          backgroundColor: DesignTokens.colors.background.primary,
        },
        contentStyle: {
          backgroundColor: DesignTokens.colors.background.primary,
        },
      }}
    >
      <Stack.Screen 
        name="CoursesScreen" 
        component={CoursesScreen}
        options={{ title: 'קורסים' }}
      />
      <Stack.Screen 
        name="LearningScreen" 
        component={LearningScreen}
        options={{ title: 'קורס' }}
      />
            <Stack.Screen
              name="CourseDetailScreen"
              component={CourseDetailScreen}
              options={{ title: 'פרטי קורס' }}
            />
            <Stack.Screen
              name="CoursePreviewScreen"
              component={CoursePreviewScreen}
              options={{ title: 'תצוגה מקדימה' }}
            />
            <Stack.Screen
              name="MyNotesScreen"
              component={MyNotesScreen}
              options={{ title: 'ההערות שלי' }}
            />
    </Stack.Navigator>
  );
}

