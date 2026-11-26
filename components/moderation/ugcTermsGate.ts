import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { showAppDialog } from '../../utils/appDialog';
import { acceptUgcTerms, hasAcceptedUgcTerms } from '../../services/moderationService';
import { supabase } from '../../services/supabase';
import { silent } from '../../utils/silentError';

const accepted = new Set<string>();
const storageKey = (uid: string) => `ugc_terms_accepted:${uid}`;

/**
 * לפני הכתיבה הראשונה (הודעה / פוסט / תגובה / סטורי) — אישור תנאי השימוש עם «אפס סובלנות»
 * לתוכן פוגעני ולמשתמשים פוגעניים (Apple 1.2). נשמר בשרת (users.ugc_terms_accepted_at).
 * מחזיר true אם אפשר להמשיך.
 */
export async function ensureUgcTermsAccepted(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return false;
  if (accepted.has(uid)) return true;
  try {
    if ((await AsyncStorage.getItem(storageKey(uid))) === '1') {
      accepted.add(uid);
      return true;
    }
  } catch {
    /* ממשיכים לבדיקה בשרת */
  }
  if (await hasAcceptedUgcTerms()) {
    accepted.add(uid);
    void AsyncStorage.setItem(storageKey(uid), '1').catch(silent('ugcTermsGate'));
    return true;
  }

  for (;;) {
    const choice = await showAppDialog({
      title: 'כללי הקהילה',
      message:
        'ב-DarkPool יש אפס סובלנות לתוכן פוגעני: הטרדה, דברי שנאה, תוכן מיני, הונאות, ספאם או המלצות מטעות. ' +
        'תוכן כזה יוסר, והמשתמש שפרסם אותו ייחסם. אפשר לדווח על כל הודעה ולחסום כל משתמש.\n\n' +
        'כדי לכתוב בקהילה צריך להסכים לתנאי השימוש.',
      closeOnBackdropPress: false,
      buttons: [{ text: 'אני מסכים' }, { text: 'קריאת תנאי השימוש' }, { text: 'לא עכשיו', style: 'cancel' }],
    });
    if (choice === 1) {
      await Linking.openURL('https://darkpool.site/terms').catch(silent('ugcTermsGate'));
      continue;
    }
    if (choice !== 0) return false;
    break;
  }
  const ok = await acceptUgcTerms();
  if (ok) {
    accepted.add(uid);
    void AsyncStorage.setItem(storageKey(uid), '1').catch(silent('ugcTermsGate'));
  }
  return ok;
}
