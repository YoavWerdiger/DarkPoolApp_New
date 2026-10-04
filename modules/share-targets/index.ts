import { requireOptionalNativeModule } from 'expo-modules-core';

type ShareTargetsNative = {
  /** iOS: תרומת INSendMessageIntent · Android: sharing shortcut ארוך-טווח. */
  donate(id: string, name: string, iconUri: string | null, launchUrl: string): Promise<void>;
  remove(id: string): Promise<void>;
  removeAll(): Promise<void>;
  /** Android: מזהה הקבוצה שנבחרה בשורת הכיוון של גיליון השיתוף (נצרך פעם אחת). */
  consumeShareTargetId(): string | null;
};

/** null ב-Expo Go / build ישן בלי המודול. */
export default requireOptionalNativeModule<ShareTargetsNative>('ShareTargets');
