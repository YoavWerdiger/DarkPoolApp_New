import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LearningScreen from '../screens/Learning';
import { CoursesScreen } from '../screens/Learning/CoursesScreen';
import { CourseDetailScreen } from '../screens/Learning/CourseDetailScreen';
import { CourseComingSoonScreen } from '../screens/Learning/CourseComingSoonScreen';
import { CoursePreviewScreen } from '../screens/Learning/CoursePreviewScreen';
import { MyNotesScreen } from '../screens/Learning/MyNotesScreen';
import { LessonPlayerScreen } from '../screens/Learning/LessonPlayerScreen';

/** מסכי אקדמיה — ScreenChrome (שחור + גרדיאנט). LessonPlayer עם רקע נייטרלי משלו. */
const CoursesScreenPlain = CoursesScreen;
const LearningWithVideo = LearningScreen;
const CourseDetailWithVideo = CourseDetailScreen;
const CourseComingSoonPlain = CourseComingSoonScreen;
const CoursePreviewWithVideo = CoursePreviewScreen;
const LessonPlayerPlain = LessonPlayerScreen;
const MyNotesWithVideo = MyNotesScreen;

export type LearningStackParamList = {
  CoursesScreen: undefined;
  LearningScreen: { courseId?: string; lessonId?: string };
  CourseDetailScreen: { courseId: string };
  CourseComingSoonScreen: {
    courseId: string;
    title?: string;
    subtitle?: string;
    coverUrl?: string;
  };
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
        contentStyle: { backgroundColor: '#111111' },
        animation: 'fade',
        gestureEnabled: true,
        animationDuration: 200,
      }}
    >
      <Stack.Screen
        name="CoursesScreen"
        component={CoursesScreenPlain}
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
        name="CourseComingSoonScreen"
        component={CourseComingSoonPlain}
        options={{ title: 'בקרוב' }}
      />
      <Stack.Screen
        name="CoursePreviewScreen"
        component={CoursePreviewWithVideo}
        options={{ title: 'תצוגה מקדימה' }}
      />
      <Stack.Screen
        name="LessonPlayerScreen"
        component={LessonPlayerPlain}
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

