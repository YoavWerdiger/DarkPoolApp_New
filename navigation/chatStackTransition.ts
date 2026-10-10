/**
 * מעברי native-stack של הצ'אט — ה-push המובנה של המערכת.
 * בלי animationDuration: משך מותאם אישית מפרק את הסלייד (התוכן נצבע לפני הרקע).
 * רקע הקנבס אטום כדי שהכרטיס יזוז כיחידה אחת, לא שקוף מעל המסך הקודם.
 * מקפיא את RAF של האורורה רק בזמן transition (בלי לגעת ב-GLSL).
 */

import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { pauseAurora, resumeAurora } from '../components/ui/auroraRuntime';
import { LIGHT_CANVAS } from '../components/ui/designTokensStatic';
import { SoftUI } from '../components/ui/softUiPalette';

/**
 * iOS: ה-push המובנה (~350ms). Android: ios_from_right — אנימציה מובנית של react-native-screens
 * שמחקה את iOS (אותו כיוון וקצב), במקום slide_from_right שמזיז את שני המסכים ב-400ms ומרגיש איטי.
 */
export const CHAT_STACK_ANIMATION = (Platform.OS === 'android' ? 'ios_from_right' : 'slide_from_right') as
  | 'ios_from_right'
  | 'slide_from_right';

/** משך המערכת בפועל — לא מועבר כ-animationDuration. */
export const CHAT_STACK_ANIMATION_MS = 350;

/** אם transitionEnd לא מגיע — לא משאירים את האורורה קפואה. ארוך מספיק ל-swipe-back מוחזק. */
export const CHAT_AURORA_HOLD_FAILSAFE_MS = 4000;

export function createChatStackScreenOptions(isDarkMode = true): NativeStackNavigationOptions {
  return {
    headerShown: false,
    contentStyle: { backgroundColor: isDarkMode ? SoftUI.canvas : LIGHT_CANVAS },
    animation: CHAT_STACK_ANIMATION,
    gestureEnabled: true,
    freezeOnBlur: false,
  };
}

let auroraHeld = false;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

export function isChatAuroraTransitionHeld(): boolean {
  return auroraHeld;
}

export function pauseAuroraForChatTransition(): void {
  if (!auroraHeld) {
    auroraHeld = true;
    pauseAurora();
  }
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumeAuroraForChatTransition();
  }, CHAT_AURORA_HOLD_FAILSAFE_MS);
}

export function resumeAuroraForChatTransition(): void {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  if (!auroraHeld) return;
  auroraHeld = false;
  resumeAurora();
}

/** בדיקות בלבד */
export function resetChatAuroraTransitionHold(): void {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  if (auroraHeld) {
    auroraHeld = false;
    resumeAurora();
  }
}

export const chatStackScreenListeners = {
  transitionStart: () => {
    pauseAuroraForChatTransition();
  },
  transitionEnd: () => {
    resumeAuroraForChatTransition();
  },
};

/** אקדמיה משתמשת באותו slide + הקפאת אורורה — בלי לשכפל את הלוגיקה. */
export const createLearningStackScreenOptions = createChatStackScreenOptions;
export const learningStackScreenListeners = chatStackScreenListeners;
