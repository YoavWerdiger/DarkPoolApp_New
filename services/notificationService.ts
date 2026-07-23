import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';

// בדיקה אם רצים ב-Expo Go או באפליקציית פרודקשן
// appOwnership = 'expo' when running in Expo Go
// appOwnership = null or undefined when running in standalone/production builds
const isExpoGo = Constants.appOwnership === 'expo';
const appEnvironment = isExpoGo ? 'expo-go' : 'production';

import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async (_notification) => {
    let shouldPlaySound = true;
    try {
      const saved = await AsyncStorage.getItem('notificationSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sound === false) shouldPlaySound = false;
      }
    } catch {}
    return {
      shouldShowAlert: true,
      shouldPlaySound,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// הגדרת Notification Channels לאנדרואיד
async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    // Channel להתראות צ'אט - עדיפות גבוהה עם צליל
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'הודעות צ\'אט',
      description: 'התראות על הודעות חדשות בצ\'אטים',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00E654',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Channel להתראות כלליות
    await Notifications.setNotificationChannelAsync('default', {
      name: 'התראות כלליות',
      description: 'התראות כלליות מהאפליקציה',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    // Channel לחדשות
    await Notifications.setNotificationChannelAsync('news', {
      name: 'חדשות',
      description: 'התראות על חדשות חדשות',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // Channel ליומן כלכלי
    await Notifications.setNotificationChannelAsync('economic_events', {
      name: 'יומן כלכלי',
      description: 'התראות על תוצאות דוחות כלכליים',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('earnings', {
      name: 'דיווחי רווח',
      description: 'התראות לפני ואחרי דיווחי רווח',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

  }
}

// קריאה להגדרת ה-channels בטעינה
setupNotificationChannels();

// קבלת Expo Project ID - נבדוק מספר מקורות
const getExpoProjectId = (): string => {
  // נסה לקבל מ-Constants.expoConfig
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (fromExpoConfig) {
    return fromExpoConfig;
  }
  
  // נסה לקבל מ-Constants.manifest (גרסה ישנה)
  const fromManifest = (Constants.manifest as any)?.extra?.eas?.projectId;
  if (fromManifest) {
    return fromManifest;
  }
  
  const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  if (envProjectId) return envProjectId;

  // fallback — must be configured via EXPO_PUBLIC_PROJECT_ID or eas.json
  return 'c6140546-bf96-4ca0-85a5-26807f0742f6';
};

const EXPO_PROJECT_ID = getExpoProjectId();

export class NotificationService {
  // מניעת קריאות כפולות ל-registerDeviceToken
  private static registrationInProgress: Promise<boolean> | null = null;
  // Request permissions
  static async requestPermissions(forceRequest: boolean = false): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // אם forceRequest = true, נבקש הרשאות גם אם כבר ניתנו (כדי להציג את הדיאלוג)
    if (existingStatus !== 'granted' || forceRequest) {
      try {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      } catch (error) {
        logger.error('Notification', 'Error requesting permissions', error);
        // אם יש שגיאה, נשתמש בסטטוס הקיים
        finalStatus = existingStatus;
      }
    }

    return finalStatus === 'granted';
  }

  // Get Expo Push Token
  static async getExpoPushToken(forceRefresh: boolean = false): Promise<string | null> {
    try {
      // בדיקה אם זה סימולטור/אמולטור אמיתי
      // נבדוק מספר אינדיקטורים - רק אם כולם מצביעים על סימולטור, נחסום
      const isLikelySimulator = !Device.isDevice && 
                                !Device.modelName && 
                                !Device.brand && 
                                !Device.deviceName;
      
      if (isLikelySimulator) {
        return null;
      }

      // בדוק שההרשאות ניתנו לפני שניסיון לקבל token
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PROJECT_ID,
        });

        if (!token || !token.data) {
          return null;
        }

        return token.data;
      } catch (error) {
        logger.error('Notification', 'Error in getExpoPushTokenAsync', error);
        return null;
      }
    } catch (error) {
      logger.error('Notification', 'Error getting Expo push token', error);
      return null;
    }
  }

  // Try to get push token directly (without requesting permissions again)
  static async getPushTokenDirectly(): Promise<string | null> {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    return await this.getExpoPushToken();
  }

  // Register device token in Supabase
  static async registerDeviceToken(): Promise<boolean> {
    if (this.registrationInProgress) {
      return this.registrationInProgress;
    }

    this.registrationInProgress = this._doRegisterDeviceToken();
    try {
      return await this.registrationInProgress;
    } finally {
      this.registrationInProgress = null;
    }
  }
  
  private static async _doRegisterDeviceToken(): Promise<boolean> {
    try {
      // בדיקה אם זה סימולטור/אמולטור אמיתי
      const isLikelySimulator = !Device.isDevice && 
                                !Device.modelName && 
                                !Device.brand && 
                                !Device.deviceName;
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        logger.error('Notification', 'Error getting user', userError);
        return false;
      }
      
      if (!user) {
        return false;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      const token = await this.getExpoPushToken();

      if (!token) {
        return false;
      }

      const deviceId = Device.modelName || 'unknown';
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      // אזהרה אם רצים ב-Expo Go
      if (isExpoGo) {
        logger.warn('Notification', 'Running in Expo Go - token will be for Expo Go, not production app');
      }

      // 🚨 אם אנחנו בפרודקשן, נבטל את כל הטוקנים הישנים של המשתמש הזה
      // כי ייתכן שיש טוקנים ישנים מ-Expo Go
      if (!isExpoGo) {
        const { error: deactivateError } = await supabase
          .from('device_tokens')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .neq('expo_push_token', token); // לא לבטל את הטוקן הנוכחי

        if (deactivateError) {
          logger.warn('Notification', 'Error deactivating old tokens');
        }
      }

      const { data: existingToken, error: selectError } = await supabase
        .from('device_tokens')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('expo_push_token', token)
        .maybeSingle();

      if (selectError) {
        logger.error('Notification', 'Error checking existing token', selectError);
      }

      if (existingToken) {
        const { error } = await supabase
          .from('device_tokens')
          .update({
            is_active: true,
            device_id: deviceId,
            platform,
            app_version: appVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingToken.id);

        if (error) {
          logger.error('Notification', 'Error updating device token', error);
          return false;
        }

        return true;
      } else {
        const { error, data } = await supabase
          .from('device_tokens')
          .insert({
            user_id: user.id,
            expo_push_token: token,
            device_id: deviceId,
            platform,
            app_version: appVersion,
            is_active: true,
          })
          .select();

        if (error) {
          // אם זו שגיאת UNIQUE constraint, ננסה לעדכן את הטוקן הקיים
          if (error.code === '23505') {
            // ננסה למצוא את הטוקן הקיים ולעדכן אותו
            const { data: existingToken, error: selectError } = await supabase
              .from('device_tokens')
              .select('id')
              .eq('user_id', user.id)
              .eq('expo_push_token', token)
              .maybeSingle();
            
            if (existingToken && !selectError) {
              const { error: updateError } = await supabase
                .from('device_tokens')
                .update({
                  is_active: true,
                  device_id: deviceId,
                  platform,
                  app_version: appVersion,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingToken.id);
              
              if (updateError) {
                logger.error('Notification', 'Error updating existing token after duplicate key', updateError);
                return false;
              }

              return true;
            }
          }

          logger.error('Notification', 'Error inserting device token', error);
          return false;
        }

        return true;
      }
    } catch (error) {
      logger.error('Notification', 'Exception in registerDeviceToken', error);
      return false;
    }
  }

  // Unregister device token (with optional userId - if not provided, gets from auth)
  static async unregisterDeviceToken(userId?: string): Promise<boolean> {
    try {
      let targetUserId = userId;
      
      // אם לא סופק userId, ננסה לקבל מהמשתמש המחובר
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return false;
        }
        targetUserId = user.id;
      }

      const token = await this.getExpoPushToken();
      if (!token) {
        return false;
      }

      // נסה למחוק את הטוקן (להגדיר is_active = false)
      const { error } = await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', targetUserId)
        .eq('expo_push_token', token);

      if (error) {
        logger.error('Notification', 'Error unregistering device token', error);
        const { error: deleteError } = await supabase
          .from('device_tokens')
          .delete()
          .eq('user_id', targetUserId)
          .eq('expo_push_token', token);

        if (deleteError) {
          logger.error('Notification', 'Error deleting device token', deleteError);
          return false;
        }
        return true;
      }

      return true;
    } catch (error) {
      logger.error('Notification', 'Error unregistering device token', error);
      return false;
    }
  }

  // Send local notification (for testing)
  static async sendLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  }

  // Handle notification received while app is in foreground
  static addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  // Handle notification response (when user taps notification)
  static addNotificationResponseReceivedListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Send push notification via Supabase Edge Function
  static async sendPushNotification(userIds: string[], title: string, body: string, data?: any) {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userIds,
          title,
          body,
          data,
        },
      });

      if (error) {
        logger.error('Notification', 'Error sending push notification', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Notification', 'Error sending push notification', error);
      return false;
    }
  }
} 