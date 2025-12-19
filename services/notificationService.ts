import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// קבלת Expo Project ID - נבדוק מספר מקורות
const getExpoProjectId = (): string => {
  // נסה לקבל מ-Constants.expoConfig
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (fromExpoConfig) {
    console.log('📱 NotificationService: Got projectId from Constants.expoConfig:', fromExpoConfig);
    return fromExpoConfig;
  }
  
  // נסה לקבל מ-Constants.manifest (גרסה ישנה)
  const fromManifest = (Constants.manifest as any)?.extra?.eas?.projectId;
  if (fromManifest) {
    console.log('📱 NotificationService: Got projectId from Constants.manifest:', fromManifest);
    return fromManifest;
  }
  
  // fallback לערך קבוע
  const fallback = 'c6140546-bf96-4ca0-85a5-26807f0742f6';
  console.log('⚠️ NotificationService: Using fallback projectId:', fallback);
  console.log('📱 NotificationService: Constants.expoConfig:', Constants.expoConfig);
  console.log('📱 NotificationService: Constants.manifest:', Constants.manifest);
  return fallback;
};

const EXPO_PROJECT_ID = getExpoProjectId();

export class NotificationService {
  // מניעת קריאות כפולות ל-registerDeviceToken
  private static registrationInProgress: Promise<boolean> | null = null;
  private static registrationLock: boolean = false;
  // Request permissions
  static async requestPermissions(forceRequest: boolean = false): Promise<boolean> {
    console.log('📱 NotificationService: Requesting permissions...');
    console.log('📱 NotificationService: Device.isDevice =', Device.isDevice);
    console.log('📱 NotificationService: forceRequest =', forceRequest);

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('📱 NotificationService: Existing permission status:', existingStatus);
    let finalStatus = existingStatus;

    // אם forceRequest = true, נבקש הרשאות גם אם כבר ניתנו (כדי להציג את הדיאלוג)
    if (existingStatus !== 'granted' || forceRequest) {
      console.log('📱 NotificationService: Requesting permissions (will show dialog)...');
      try {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: false,
          },
        });
        finalStatus = status;
        console.log('📱 NotificationService: Permission request result:', status);
      } catch (error) {
        console.error('❌ NotificationService: Error requesting permissions:', error);
        // אם יש שגיאה, נשתמש בסטטוס הקיים
        finalStatus = existingStatus;
      }
    }

    if (finalStatus === 'granted') {
      console.log('✅ NotificationService: Permissions granted');
    } else {
      console.log('❌ NotificationService: Permissions denied, status:', finalStatus);
    }

    return finalStatus === 'granted';
  }

  // Get Expo Push Token
  static async getExpoPushToken(forceRefresh: boolean = false): Promise<string | null> {
    try {
      console.log('📱 NotificationService: Getting Expo push token...');
      console.log('📱 NotificationService: Device.isDevice =', Device.isDevice);
      console.log('📱 NotificationService: EXPO_PROJECT_ID =', EXPO_PROJECT_ID);
      console.log('📱 NotificationService: forceRefresh =', forceRefresh);

      // בדיקה אם זה סימולטור/אמולטור אמיתי
      // נבדוק מספר אינדיקטורים - רק אם כולם מצביעים על סימולטור, נחסום
      const isLikelySimulator = !Device.isDevice && 
                                !Device.modelName && 
                                !Device.brand && 
                                !Device.deviceName;
      
      if (isLikelySimulator) {
        console.log('⚠️ NotificationService: Running on simulator/emulator, cannot get push token');
        console.log('💡 NotificationService: To test push notifications, use a physical device');
        return null;
      }
      
      // אם Device.isDevice = false אבל יש אינדיקטורים של מכשיר פיזי, ננסה בכל זאת
      if (!Device.isDevice) {
        console.log('⚠️ NotificationService: Device.isDevice is false but device info exists:');
        console.log('   - modelName:', Device.modelName);
        console.log('   - brand:', Device.brand);
        console.log('   - deviceName:', Device.deviceName);
        console.log('💡 NotificationService: This might be a physical device - will attempt to get token anyway');
      }

      // בדוק שההרשאות ניתנו לפני שניסיון לקבל token
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('⚠️ NotificationService: Permissions not granted, cannot get push token');
        console.log('💡 NotificationService: Status:', status);
        return null;
      }

      console.log('✅ NotificationService: Permissions granted, requesting push token...');
      console.log('📱 NotificationService: Calling Notifications.getExpoPushTokenAsync with projectId:', EXPO_PROJECT_ID);
      
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PROJECT_ID,
        });
        
        console.log('📱 NotificationService: getExpoPushTokenAsync returned:', token ? 'token exists' : 'null');
        
        if (!token || !token.data) {
          console.log('⚠️ NotificationService: No token data received');
          console.log('💡 NotificationService: Token object:', JSON.stringify(token, null, 2));
          return null;
        }
        
        console.log('✅ NotificationService: Got Expo push token:', token.data.substring(0, 20) + '...');
        console.log('✅ NotificationService: Full token length:', token.data.length);
        return token.data;
      } catch (error) {
        console.error('❌ NotificationService: Error in getExpoPushTokenAsync:', error);
        if (error instanceof Error) {
          console.error('❌ NotificationService: Error message:', error.message);
          console.error('❌ NotificationService: Error stack:', error.stack);
        }
        return null;
      }
    } catch (error) {
      console.error('❌ NotificationService: Error getting Expo push token:', error);
      if (error instanceof Error) {
        console.error('❌ NotificationService: Error message:', error.message);
        console.error('❌ NotificationService: Error stack:', error.stack);
        
        // אם זו שגיאה של permissions, נסביר למשתמש
        if (error.message.includes('permission') || error.message.includes('Permission')) {
          console.log('💡 NotificationService: Permission error - user may need to grant permissions in device settings');
        }
      } else {
        console.error('❌ NotificationService: Error details:', JSON.stringify(error, null, 2));
      }
      return null;
    }
  }

  // Try to get push token directly (without requesting permissions again)
  static async getPushTokenDirectly(): Promise<string | null> {
    console.log('📱 NotificationService: Attempting to get push token directly...');
    
    // בדוק שההרשאות ניתנו
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('⚠️ NotificationService: Permissions not granted, cannot get token directly');
      console.log('💡 NotificationService: Status:', status);
      return null;
    }
    
    console.log('✅ NotificationService: Permissions already granted, getting token...');
    return await this.getExpoPushToken();
  }

  // Register device token in Supabase
  static async registerDeviceToken(): Promise<boolean> {
    // אם יש רישום שכבר רץ, נחזיר את אותו Promise
    if (this.registrationInProgress) {
      console.log('⏳ NotificationService: Registration already in progress, waiting...');
      return await this.registrationInProgress;
    }
    
    // בדוק lock - אם יש רישום שכבר רץ, חכה
    if (this.registrationLock) {
      console.log('⏳ NotificationService: Registration lock active, waiting...');
      // נחכה קצת וננסה שוב
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.registrationInProgress) {
        return await this.registrationInProgress;
      }
    }
    
    // הגדר lock
    this.registrationLock = true;
    
    // התחל רישום חדש
    this.registrationInProgress = this._doRegisterDeviceToken();
    
    try {
      const result = await this.registrationInProgress;
      return result;
    } finally {
      // נקה את ה-Promise ואת ה-lock אחרי שהסתיים
      this.registrationInProgress = null;
      this.registrationLock = false;
    }
  }
  
  private static async _doRegisterDeviceToken(): Promise<boolean> {
    try {
      console.log('📱 NotificationService: ==========================================');
      console.log('📱 NotificationService: Starting device token registration...');
      console.log('📱 NotificationService: Device.isDevice =', Device.isDevice);
      console.log('📱 NotificationService: Device.modelName =', Device.modelName);
      console.log('📱 NotificationService: Device.brand =', Device.brand);
      console.log('📱 NotificationService: Device.deviceName =', Device.deviceName);
      console.log('📱 NotificationService: Platform.OS =', Platform.OS);
      console.log('📱 NotificationService: EXPO_PROJECT_ID =', EXPO_PROJECT_ID);
      
      // בדיקה אם זה סימולטור/אמולטור אמיתי
      const isLikelySimulator = !Device.isDevice && 
                                !Device.modelName && 
                                !Device.brand && 
                                !Device.deviceName;
      
      if (isLikelySimulator) {
        console.log('⚠️ NotificationService: Running on simulator/emulator');
        console.log('💡 NotificationService: Will attempt to get token anyway (might work in some cases)');
      } else if (!Device.isDevice) {
        console.log('⚠️ NotificationService: Device.isDevice is false but device info exists:');
        console.log('   - modelName:', Device.modelName);
        console.log('   - brand:', Device.brand);
        console.log('   - deviceName:', Device.deviceName);
        console.log('💡 NotificationService: This might be a physical device - will attempt to get token anyway');
      } else {
        console.log('✅ NotificationService: Device.isDevice = true - confirmed physical device');
      }
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('❌ NotificationService: Error getting user:', userError);
        console.error('❌ NotificationService: Error code:', userError.code);
        console.error('❌ NotificationService: Error message:', userError.message);
        return false;
      }
      
      if (!user) {
        console.log('⚠️ NotificationService: No authenticated user, cannot register token');
        console.log('💡 NotificationService: User needs to be logged in first');
        return false;
      }

      console.log('✅ NotificationService: User found:', user.id);
      console.log('✅ NotificationService: User email:', user.email);

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('⚠️ NotificationService: No permissions, cannot register token');
        console.log('💡 NotificationService: User needs to grant notification permissions in device settings');
        console.log('💡 NotificationService: On iOS: Settings > DarkPool > Notifications');
        console.log('💡 NotificationService: On Android: Settings > Apps > DarkPool > Notifications');
        return false;
      }

      console.log('✅ NotificationService: Permissions granted');

      console.log('📱 NotificationService: ==========================================');
      console.log('📱 NotificationService: Attempting to get Expo push token...');
      console.log('📱 NotificationService: Device.isDevice =', Device.isDevice);
      console.log('📱 NotificationService: Device.modelName =', Device.modelName);
      console.log('📱 NotificationService: Device.brand =', Device.brand);
      console.log('📱 NotificationService: Device.deviceName =', Device.deviceName);
      console.log('📱 NotificationService: Platform.OS =', Platform.OS);
      console.log('📱 NotificationService: EXPO_PROJECT_ID =', EXPO_PROJECT_ID);
      console.log('📱 NotificationService: ==========================================');
      
      const token = await this.getExpoPushToken();
      
      console.log('📱 NotificationService: ==========================================');
      console.log('📱 NotificationService: getExpoPushToken returned:', token ? 'TOKEN RECEIVED ✅' : 'NULL ❌');
      if (token) {
        console.log('📱 NotificationService: Token preview:', token.substring(0, 30) + '...');
        console.log('📱 NotificationService: Token length:', token.length);
      }
      console.log('📱 NotificationService: ==========================================');
      
      if (!token) {
        console.log('❌ NotificationService: ==========================================');
        console.log('❌ NotificationService: No token received!');
        console.log('❌ NotificationService: Device.isDevice =', Device.isDevice);
        console.log('❌ NotificationService: Device.modelName =', Device.modelName);
        console.log('❌ NotificationService: Device.brand =', Device.brand);
        console.log('❌ NotificationService: Device.deviceName =', Device.deviceName);
        console.log('💡 NotificationService: This might happen if:');
        console.log('   - Device is not physical (simulator/emulator)');
        console.log('   - Expo Push Token service is unavailable');
        console.log('   - Network connection issue');
        console.log('   - Invalid EXPO_PROJECT_ID');
        console.log('   - Firebase not initialized correctly');
        console.log('❌ NotificationService: ==========================================');
        return false;
      }

      console.log('✅ NotificationService: Got Expo Push Token:', token.substring(0, 20) + '...');
      console.log('✅ NotificationService: Full token length:', token.length);

      const deviceId = Device.modelName || 'unknown';
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const appVersion = Constants.expoConfig?.version || '1.0.0';
      
      console.log('📱 NotificationService: Device info:', { deviceId, platform, appVersion });

      // בדיקה אם ה-token כבר קיים
      console.log('🔍 NotificationService: Checking for existing token...');
      console.log('🔍 NotificationService: Query params:', {
        user_id: user.id,
        token_preview: token.substring(0, 20) + '...'
      });
      
      const { data: existingToken, error: selectError } = await supabase
        .from('device_tokens')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('expo_push_token', token)
        .maybeSingle();

      if (selectError) {
        console.error('❌ NotificationService: Error checking existing token:', selectError);
        console.error('❌ NotificationService: Error code:', selectError.code);
        console.error('❌ NotificationService: Error message:', selectError.message);
        console.error('❌ NotificationService: Error details:', JSON.stringify(selectError, null, 2));
      } else {
        console.log('🔍 NotificationService: Existing token check result:', existingToken ? 'Found' : 'Not found');
      }

      if (existingToken) {
        // עדכון token קיים
        console.log('🔄 NotificationService: Token exists, updating...');
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
          console.error('❌ NotificationService: Error updating device token:', error);
          console.error('❌ NotificationService: Error details:', JSON.stringify(error, null, 2));
          return false;
        }

        console.log('✅ NotificationService: Device token updated successfully');
        return true;
      } else {
        // הוספת token חדש
        console.log('➕ NotificationService: Inserting new token...');
        console.log('📝 NotificationService: Token data:', {
          user_id: user.id,
          platform,
          device_id: deviceId,
          app_version: appVersion,
          token_preview: token.substring(0, 20) + '...'
        });
        
        console.log('📝 NotificationService: Attempting to insert device token...');
        console.log('📝 NotificationService: Insert data:', {
          user_id: user.id,
          expo_push_token: token.substring(0, 20) + '...',
          device_id: deviceId,
          platform,
          app_version: appVersion,
          is_active: true,
        });
        
        console.log('📝 NotificationService: Full token (for debugging):', token);
        console.log('📝 NotificationService: User ID:', user.id);
        console.log('📝 NotificationService: About to call supabase.insert...');
        
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
        
        console.log('📝 NotificationService: Insert result received');
        console.log('📝 NotificationService: Error:', error ? 'YES ❌' : 'NO ✅');
        console.log('📝 NotificationService: Data:', data ? 'YES ✅' : 'NO ❌');

        if (error) {
          // אם זו שגיאת UNIQUE constraint, ננסה לעדכן את הטוקן הקיים
          if (error.code === '23505') {
            console.log('🔄 NotificationService: Token already exists (race condition), updating instead...');
            
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
                console.error('❌ NotificationService: Error updating existing token:', updateError);
                return false;
              }
              
              console.log('✅ NotificationService: Device token updated successfully (after duplicate key error)');
              return true;
            }
          }
          
          console.error('❌ NotificationService: ==========================================');
          console.error('❌ NotificationService: Error inserting device token');
          console.error('❌ NotificationService: Error code:', error.code);
          console.error('❌ NotificationService: Error message:', error.message);
          console.error('❌ NotificationService: Error details:', JSON.stringify(error, null, 2));
          console.error('❌ NotificationService: Error hint:', error.hint);
          
          // בדיקה אם זו שגיאת RLS
          if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
            console.error('🔒 NotificationService: RLS Policy error - user might not have permission to insert');
            console.error('💡 NotificationService: Check RLS policies on device_tokens table');
            console.error('💡 NotificationService: Run: SELECT * FROM pg_policies WHERE tablename = \'device_tokens\';');
          }
          
          console.error('❌ NotificationService: ==========================================');
          return false;
        }

        console.log('✅ NotificationService: ==========================================');
        console.log('✅ NotificationService: Device token registered successfully!');
        console.log('✅ NotificationService: Inserted data:', JSON.stringify(data, null, 2));
        console.log('✅ NotificationService: ==========================================');
        return true;
      }
    } catch (error) {
      console.error('❌ NotificationService: ==========================================');
      console.error('❌ NotificationService: Exception in registerDeviceToken');
      console.error('❌ NotificationService: Error:', error);
      console.error('❌ NotificationService: Error type:', typeof error);
      console.error('❌ NotificationService: Error details:', JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error('❌ NotificationService: Error message:', error.message);
        console.error('❌ NotificationService: Error stack:', error.stack);
      }
      console.error('❌ NotificationService: ==========================================');
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
          console.log('⚠️ NotificationService: No user found for unregistering token');
          return false;
        }
        targetUserId = user.id;
      }

      const token = await this.getExpoPushToken();
      if (!token) {
        console.log('⚠️ NotificationService: No token found for unregistering');
        return false;
      }

      console.log('📱 NotificationService: Unregistering device token for user:', targetUserId);

      // נסה למחוק את הטוקן (להגדיר is_active = false)
      const { error } = await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', targetUserId)
        .eq('expo_push_token', token);

      if (error) {
        console.error('❌ NotificationService: Error unregistering device token:', error);
        // ננסה גם למחוק לחלוטין אם עדכון נכשל
        const { error: deleteError } = await supabase
          .from('device_tokens')
          .delete()
          .eq('user_id', targetUserId)
          .eq('expo_push_token', token);
        
        if (deleteError) {
          console.error('❌ NotificationService: Error deleting device token:', deleteError);
          return false;
        }
        console.log('✅ NotificationService: Device token deleted (fallback)');
        return true;
      }

      console.log('✅ NotificationService: Device token unregistered');
      return true;
    } catch (error) {
      console.error('❌ NotificationService: Error unregistering device token:', error);
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
        console.error('❌ NotificationService: Error sending push notification:', error);
        return false;
      }

      console.log('✅ NotificationService: Push notification sent');
      return true;
    } catch (error) {
      console.error('❌ NotificationService: Error sending push notification:', error);
      return false;
    }
  }
} 