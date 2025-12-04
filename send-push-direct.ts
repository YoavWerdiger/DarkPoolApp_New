// ✅ שליחת Push Notification ישירה לטוקן ספציפי
// ================================================
// טוקן: ExponentPushToken[2vyBusP8YAUVCjygab20ta]
// User ID: af781bb1-0529-4d80-9424-6564ec29457e

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

// הטוקן הספציפי
const EXPO_PUSH_TOKEN = 'ExponentPushToken[2vyBusP8YAUVCjygab20ta]';

// יצירת הודעת push
const message = {
  to: EXPO_PUSH_TOKEN,
  sound: 'default',
  title: 'בדיקת Push Notification 📱',
  body: 'זוהי התראה לבדיקה - אם אתה רואה את זה, זה עובד!',
  subtitle: 'DarkPool',
  data: {
    type: 'test',
    timestamp: new Date().toISOString(),
    appName: 'DarkPool',
  },
  priority: 'high',
  channelId: 'default',
  // Android specific
  android: {
    channelId: 'default',
    priority: 'high',
    smallIcon: 'ic_notification',
  },
  // iOS specific
  ios: {
    sound: 'default',
    badge: 1,
  },
};

// שליחת ההתראה
async function sendPushNotification() {
  try {
    console.log('📱 שולח push notification לטוקן:', EXPO_PUSH_TOKEN);
    
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([message]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ שגיאה בשליחת push notification:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ תוצאה:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.length > 0) {
      const status = result.data[0].status;
      if (status === 'ok') {
        console.log('✅ Push notification נשלח בהצלחה!');
      } else {
        console.error('❌ Push notification נכשל:', result.data[0]);
      }
    }
  } catch (error) {
    console.error('❌ שגיאה:', error);
  }
}

// הרצת הפונקציה
sendPushNotification();


