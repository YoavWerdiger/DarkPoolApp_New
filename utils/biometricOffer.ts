import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { loadAppSettings, saveAppSettings } from '../services/appSettings';
import { showAppDialog } from './appDialog';
import { HapticFeedback } from './hapticFeedback';
import { logger } from './logger';

const OFFERED_KEY = 'biometric_offer_shown_v1';

/**
 * אחרי התחברות מוצלחת — הצעה חד-פעמית להפעיל כניסה עם Face ID / טביעת אצבע,
 * במקום שהאפשרות תהיה קבורה בהגדרות.
 */
export async function maybeOfferBiometricLogin(): Promise<void> {
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if ((await AsyncStorage.getItem(OFFERED_KEY)) === '1') return;
    const settings = await loadAppSettings();
    if (settings.biometricAuth) return;
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return;
    await AsyncStorage.setItem(OFFERED_KEY, '1');

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const name = Platform.OS === 'ios' ? (face ? 'Face ID' : 'Touch ID') : 'טביעת אצבע';
    const choice = await showAppDialog({
      title: `כניסה מהירה עם ${name}?`,
      message: `בפעם הבאה שתפתח את DarkPool נבקש ${name} במקום סיסמה. אפשר לשנות בכל רגע בהגדרות.`,
      buttons: [{ text: 'הפעלה' }, { text: 'לא עכשיו', style: 'cancel' }],
    });
    if (choice !== 0) return;
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: `הפעלת ${name}`, disableDeviceFallback: false });
    if (!res.success) return;
    await saveAppSettings({ biometricAuth: true });
    void HapticFeedback.success();
  } catch (e) {
    logger.warn('biometricOffer', 'failed', e);
  }
}
