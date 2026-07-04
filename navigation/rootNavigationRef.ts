import { createNavigationContainerRef } from '@react-navigation/native';

/** הפניה גלובלית ל־NavigationContainer — לפתיחת מגירה ממסכים שלא בתוך ה־Drawer (למשל Profile) */
export const rootNavigationRef = createNavigationContainerRef<any>();
