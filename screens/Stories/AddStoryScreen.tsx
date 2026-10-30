import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import AddStoryFullScreen from '../../components/chat/AddStoryFullScreen';

/**
 * יצירת סטורי — מסך בסטאק הראשי (fullScreenModal), לא Modal של RN.
 * ה-Modal נשאר פתוח ב-iOS אחרי שיתוף (שקוף, חוסם נגיעות) — הסטאק הנייטיב נסגר באמינות.
 * ההעלאה עצמה רצה ברקע (lib/pendingStories) ולא תלויה במסך.
 */
export default function AddStoryScreen() {
  const navigation = useNavigation();
  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);
  return <AddStoryFullScreen presentation="screen" visible onClose={close} onAdded={() => {}} />;
}
