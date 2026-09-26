/**
 * Safe loader for expo-gl (SDK 57 / Expo Go).
 *
 * `expo-gl` calls `requireNativeModule('ExpoGL')` at import time. If the native
 * module is missing, that crashes the app — same class of bug as expo-av in Go.
 * Probe first, then require; callers fall back to the procedural aurora.
 */
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

function probeNativeGl(): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return requireOptionalNativeModule('ExpoGL') != null;
  } catch {
    return false;
  }
}

function tryLoadExpoGl(): { GLView: ComponentType<any> } | null {
  if (!probeNativeGl()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-gl');
    if (!mod?.GLView) return null;
    return mod;
  } catch {
    return null;
  }
}

const loaded = tryLoadExpoGl();

export const isExpoGlAvailable = loaded != null;
export const GLView = loaded?.GLView ?? null;
