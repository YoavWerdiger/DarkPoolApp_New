import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** רטט לכפתור תפריט/מגירה — export נפרד כדי שלא ייעלם בגלל cache של Metro */
export async function triggerDrawerMenuHaptic(): Promise<void> {
  try {
    const Haptics = require('expo-haptics');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    try {
      Vibration.vibrate(Platform.OS === 'ios' ? 10 : 15);
    } catch {
      /* noop */
    }
  }
}

/** שם חלופי — אם קוד ישן קורא לפונקציה ולא ל־`HapticFeedback.drawerMenuTap` */
export async function drawerMenuTap(): Promise<void> {
  return triggerDrawerMenuHaptic();
}

export class HapticFeedback {
  private static _enabled: boolean = true;
  private static _initialized: boolean = false;

  static async init() {
    if (HapticFeedback._initialized) return;
    HapticFeedback._initialized = true;
    try {
      const saved = await AsyncStorage.getItem('notificationSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        HapticFeedback._enabled = parsed.vibration !== false;
      }
    } catch {}
  }

  static setEnabled(enabled: boolean) {
    HapticFeedback._enabled = enabled;
  }

  static isEnabled(): boolean {
    return HapticFeedback._enabled;
  }

  private static async ensureInit() {
    if (!HapticFeedback._initialized) {
      await HapticFeedback.init();
    }
  }

  static async light() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate(10);
    } catch {}
  }

  static async medium() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate(25);
    } catch {}
  }

  static async heavy() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate(50);
    } catch {}
  }

  static async success() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate([0, 10, 50, 10]);
    } catch {}
  }

  static async warning() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate([0, 25, 25, 25]);
    } catch {}
  }

  static async error() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate([0, 50, 50, 50, 50, 50]);
    } catch {}
  }

  static async selection() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      Vibration.vibrate(5);
    } catch {}
  }

  /**
   * רטט עדין (מומלץ לכפתורים). קודם expo-haptics; אם נכשל — Vibration (עובד גם כש־Haptics לא זמין / Expo Go).
   */
  static async impactLight() {
    try {
      await HapticFeedback.ensureInit();
      if (!HapticFeedback._enabled) return;
      try {
        const Haptics = require('expo-haptics');
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        Vibration.vibrate(Platform.OS === 'ios' ? 8 : 12);
      }
    } catch {
      /* noop */
    }
  }

  /**
   * רטט לפתיחת תפריט / מגירה — לא תלוי ב־"רטט להתראות".
   * @deprecated מעדיף `triggerDrawerMenuHaptic()` (ייבוא ישיר)
   */
  static drawerMenuTap = () => triggerDrawerMenuHaptic();
}
