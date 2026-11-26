import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { showAppDialog } from '../../utils/appDialog';
import { NotificationService } from '../../services/notificationService';
import { logger } from '../../utils/logger';

const KEY = 'push_primer_last_asked_v1';
const REASK_AFTER_MS = 14 * 86_400_000;

/**
 * הסבר לפני בקשת הרשאת ההתראות של המערכת — נקרא אחרי «רגע של ערך»
 * (הוספה ל-Watchlist, כניסה ראשונה לצ'אט). מסך המערכת מוצג רק אם המשתמש לחץ «הפעלת התראות»,
 * כי סירוב במסך של המערכת סופי ב-iOS. אם סירב אצלנו — שואלים שוב רק אחרי 14 יום.
 */
export async function maybeAskForPushPermission(context: 'watchlist' | 'chat' | 'alerts'): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status === 'granted') {
      void NotificationService.registerDeviceToken({ prompt: false });
      return;
    }
    if (perm.status === 'denied' && !perm.canAskAgain) return;
    const last = Number((await AsyncStorage.getItem(KEY)) || 0);
    if (last && Date.now() - last < REASK_AFTER_MS) return;
    await AsyncStorage.setItem(KEY, String(Date.now()));

    const body =
      context === 'watchlist'
        ? 'נעדכן אותך כשמניה מהרשימה שלך זזה חזק, מפרסמת דוח או מופיעה בעסקת דארק פול.'
        : context === 'chat'
          ? 'נעדכן אותך כשמגיעות הודעות חדשות בקבוצות שלך ובהכרזות של הצוות.'
          : 'נעדכן אותך ברגע שההתראה שהגדרת מתקיימת.';
    const choice = await showAppDialog({
      title: 'להפעיל התראות?',
      message: body,
      buttons: [{ text: 'הפעלת התראות' }, { text: 'לא עכשיו', style: 'cancel' }],
    });
    if (choice !== 0) return;
    await NotificationService.registerDeviceToken({ prompt: true });
  } catch (e) {
    logger.warn('pushPrimer', 'failed', e);
  }
}
