/**
 * מעברי native-stack של הצ'אט — slide מלא, בלי freeze/fade קצר שתוקע את ה-push.
 * מקפיא את RAF של האורורה רק בזמן transition (בלי לגעת ב-GLSL).
 */

import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { pauseAurora, resumeAurora } from '../components/ui/auroraRuntime';

export const CHAT_STACK_ANIMATION = 'slide_from_right' as const;

/** משך native טיפוסי — לא 90ms fade שמרגיש תקוע. */
export const CHAT_STACK_ANIMATION_MS = Platform.OS === 'android' ? 300 : 350;

/** אם transitionEnd לא מגיע — לא משאירים את האורורה קפואה. ארוך מספיק ל-swipe-back מוחזק. */
export const CHAT_AURORA_HOLD_FAILSAFE_MS = 4000;

export function createChatStackScreenOptions(): NativeStackNavigationOptions {
  return {
    headerShown: false,
    contentStyle: { backgroundColor: 'transparent' },
    animation: CHAT_STACK_ANIMATION,
    gestureEnabled: true,
    animationDuration: CHAT_STACK_ANIMATION_MS,
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
