import { Platform, Vibration } from 'react-native';

export class HapticFeedback {
  static async light() {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(10); // רטט קצר של 10ms
      }
      // iOS - ננסה להשתמש בVibration או פשוט נתעלם
      if (Platform.OS === 'ios') {
        Vibration.vibrate(10);
      }
    } catch (error) {
      // אם יש שגיאה, פשוט נתעלם
      console.log('Haptic feedback not available');
    }
  }

  static async medium() {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(25);
      }
      if (Platform.OS === 'ios') {
        Vibration.vibrate(25);
      }
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }

  static async heavy() {
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(50);
      }
      if (Platform.OS === 'ios') {
        Vibration.vibrate(50);
      }
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }

  static async success() {
    try {
      Vibration.vibrate([0, 10, 50, 10]); // דפוס רטט להצלחה
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }

  static async warning() {
    try {
      Vibration.vibrate([0, 25, 25, 25]); // דפוס רטט לאזהרה
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }

  static async error() {
    try {
      Vibration.vibrate([0, 50, 50, 50, 50, 50]); // דפוס רטט לשגיאה
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }

  static async selection() {
    try {
      Vibration.vibrate(5); // רטט קצר מאוד לבחירה
    } catch (error) {
      console.log('Haptic feedback not available');
    }
  }
}

