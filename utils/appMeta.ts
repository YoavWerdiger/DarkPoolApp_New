import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getAppVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();
  return build ? `${version} (${build})` : version;
}

export const APP_LINKS = {
  website: 'https://darkpool.site',
  privacy: 'https://darkpool.site/privacy',
  terms: 'https://darkpool.site/terms',
  supportEmail: 'support@darkpool.co.il',
  feedbackForm: 'https://forms.gle/darkpool-feedback',
  iosAppStore: 'https://apps.apple.com/app/id6755930835',
  androidPlayStore: 'https://play.google.com/store/apps/details?id=com.darkpool.app',
} as const;

export function getStoreReviewUrl(): string {
  if (Platform.OS === 'ios') {
    return APP_LINKS.iosAppStore;
  }
  return APP_LINKS.androidPlayStore;
}
