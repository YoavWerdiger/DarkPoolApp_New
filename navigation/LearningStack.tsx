import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LearningScreen from '../screens/Learning';
import { CoursesScreen } from '../screens/Learning/CoursesScreen';
import { CourseDetailScreen } from '../screens/Learning/CourseDetailScreen';
import { CoursePreviewScreen } from '../screens/Learning/CoursePreviewScreen';
import { MyNotesScreen } from '../screens/Learning/MyNotesScreen';
import { LessonPlayerScreen } from '../screens/Learning/LessonPlayerScreen';
import { withVideoBackground } from '../components/VideoBackground';

const CoursesWithVideo = withVideoBackground(CoursesScreen);
const LearningWithVideo = withVideoBackground(LearningScreen);
const CourseDetailWithVideo = withVideoBackground(CourseDetailScreen);
const CoursePreviewWithVideo = withVideoBackground(CoursePreviewScreen);
const LessonPlayerWithVideo = withVideoBackground(LessonPlayerScreen);
const MyNotesWithVideo = withVideoBackground(MyNotesScreen);

export type LearningStackParamList = {
  CoursesScreen: undefined;
  LearningScreen: { courseId?: string; lessonId?: string };
  CourseDetailScreen: { courseId: string };
  CoursePreviewScreen: { youtubeLinks?: string[] };
  LessonPlayerScreen: { lessonId: string; initialBlockIndex?: number };
  MyNotesScreen: undefined;
};

const Stack = createNativeStackNavigator<LearningStackParamList>();

export default function LearningStack() {
  return (
    <Stack.Navigator
      initialRouteName="CoursesScreen"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0E0A' },
        animation: 'fade',
        gestureEnabled: true,
        animationDuration: 200,
      }}
    >
      <Stack.Screen 
        name="CoursesScreen" 
        component={CoursesWithVideo}
        options={{ title: 'קורסים' }}
      />
      <Stack.Screen 
        name="LearningScreen" 
        component={LearningWithVideo}
        options={{ title: 'קורס' }}
      />
      <Stack.Screen
        name="CourseDetailScreen"
        component={CourseDetailWithVideo}
        options={{ title: 'פרטי קורס' }}
      />
      <Stack.Screen
        name="CoursePreviewScreen"
        component={CoursePreviewWithVideo}
        options={{ title: 'תצוגה מקדימה' }}
      />
      <Stack.Screen
        name="LessonPlayerScreen"
        component={LessonPlayerWithVideo}
        options={{ title: 'שיעור', headerShown: false }}
      />
      <Stack.Screen
        name="MyNotesScreen"
        component={MyNotesWithVideo}
        options={{ title: 'ההערות שלי' }}
      />
    </Stack.Navigator>
  );
}

