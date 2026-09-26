/**
 * Safe loader for expo-web-browser (SDK 57 / Expo Go).
 *
 * `expo-web-browser` calls `requireNativeModule('ExpoWebBrowser')` at import
 * time. If the native module is missing (Expo Go flake after reload, or a
 * client that never shipped it), a static import crashes before
 * `AppRegistry.registerComponent`. Probe first, then require.
 */
import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';

export type { WebBrowserAuthSessionResult };

function probeNativeWebBrowser(): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return requireOptionalNativeModule('ExpoWebBrowser') != null;
  } catch {
    return false;
  }
}

function tryLoadExpoWebBrowser(): typeof import('expo-web-browser') | null {
  if (!probeNativeWebBrowser()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-web-browser');
  } catch {
    return null;
  }
}

const loaded = tryLoadExpoWebBrowser();

export const isExpoWebBrowserAvailable = loaded != null;

export function maybeCompleteAuthSession(): { type: string } {
  if (!loaded?.maybeCompleteAuthSession) return { type: 'dismiss' };
  return loaded.maybeCompleteAuthSession();
}

export async function openAuthSessionAsync(
  url: string,
  redirectUrl?: string | null,
  options?: object,
): Promise<WebBrowserAuthSessionResult> {
  if (loaded?.openAuthSessionAsync) {
    return loaded.openAuthSessionAsync(url, redirectUrl, options);
  }
  return { type: 'cancel' };
}

export async function openBrowserAsync(url: string) {
  if (loaded?.openBrowserAsync) {
    return loaded.openBrowserAsync(url);
  }
  try {
    await Linking.openURL(url);
    return { type: 'opened' as const };
  } catch {
    return { type: 'cancel' as const };
  }
}
