#!/usr/bin/env node

/**
 * סקריפט לקניית Toll-Free Number ב-Twilio והוספתו ל-Messaging Service
 * 
 * הוראות שימוש:
 * ================
 * 
 * 1. התקן את Twilio SDK (אם עדיין לא מותקן):
 *    npm install twilio
 * 
 * 2. הגדר משתני סביבה:
 *    export TWILIO_ACCOUNT_SID="your_account_sid"
 *    export TWILIO_AUTH_TOKEN="your_auth_token"
 *    export TWILIO_MESSAGING_SERVICE_SID="your_messaging_service_sid"
 * 
 * 3. הרץ את הסקריפט:
 *    node scripts/buy-twilio-tollfree.js
 * 
 * או בשורה אחת:
 *    TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=yyy TWILIO_MESSAGING_SERVICE_SID=zzz node scripts/buy-twilio-tollfree.js
 * 
 * מה הסקריפט עושה:
 * ===================
 * 1. מתחבר ל-Twilio עם ה-credentials שלך
 * 2. מחפש Toll-Free numbers זמינים בארה"ב
 * 3. קונה את המספר הראשון ברשימה
 * 4. מוסיף את המספר ל-Messaging Service שהגדרת
 * 5. מציג את פרטי המספר החדש
 */

const twilio = require('twilio');

// קריאת משתני הסביבה
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

/**
 * בדיקת תקינות משתני סביבה
 */
function validateEnvironmentVariables() {
  const missing = [];
  
  if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
  if (!messagingServiceSid) missing.push('TWILIO_MESSAGING_SERVICE_SID');
  
  if (missing.length > 0) {
    console.error('❌ שגיאה: משתני סביבה חסרים:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nהגדר את המשתנים בצורה הבאה:');
    console.error('export TWILIO_ACCOUNT_SID="your_account_sid"');
    console.error('export TWILIO_AUTH_TOKEN="your_auth_token"');
    console.error('export TWILIO_MESSAGING_SERVICE_SID="your_messaging_service_sid"');
    process.exit(1);
  }
}

/**
 * חיפוש Toll-Free numbers זמינים
 */
async function searchAvailableTollFreeNumbers(client) {
  console.log('🔍 מחפש Toll-Free numbers זמינים...');
  
  try {
    const numbers = await client.availablePhoneNumbers('US')
      .tollFree
      .list({ limit: 5 });
    
    if (numbers.length === 0) {
      throw new Error('לא נמצאו Toll-Free numbers זמינים');
    }
    
    console.log(`✅ נמצאו ${numbers.length} מספרים זמינים`);
    console.log('המספר הראשון ברשימה:', numbers[0].phoneNumber);
    
    return numbers;
  } catch (error) {
    console.error('❌ שגיאה בחיפוש מספרים:', error.message);
    throw error;
  }
}

/**
 * קניית Toll-Free number
 */
async function purchasePhoneNumber(client, phoneNumber) {
  console.log(`\n💳 קונה את המספר: ${phoneNumber}...`);
  
  try {
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber,
      friendlyName: `Toll-Free purchased ${new Date().toISOString()}`
    });
    
    console.log('✅ המספר נרכש בהצלחה!');
    console.log('   SID:', purchased.sid);
    console.log('   Phone Number:', purchased.phoneNumber);
    console.log('   Friendly Name:', purchased.friendlyName);
    
    return purchased;
  } catch (error) {
    console.error('❌ שגיאה בקניית המספר:', error.message);
    throw error;
  }
}

/**
 * הוספת המספר ל-Messaging Service
 */
async function addToMessagingService(client, phoneNumberSid) {
  console.log(`\n📱 מוסיף את המספר ל-Messaging Service...`);
  
  try {
    const phoneNumber = await client.messaging.v1
      .services(messagingServiceSid)
      .phoneNumbers
      .create({ phoneNumberSid: phoneNumberSid });
    
    console.log('✅ המספר נוסף ל-Messaging Service בהצלחה!');
    console.log('   Phone Number SID:', phoneNumber.sid);
    console.log('   Messaging Service SID:', messagingServiceSid);
    
    return phoneNumber;
  } catch (error) {
    console.error('❌ שגיאה בהוספת המספר ל-Messaging Service:', error.message);
    console.error('   💡 ייתכן שה-Messaging Service SID שגוי או שאין הרשאות מתאימות');
    throw error;
  }
}

/**
 * הפונקציה הראשית
 */
async function main() {
  console.log('🚀 התחלת תהליך קניית Toll-Free Number ב-Twilio\n');
  console.log('='.repeat(60));
  
  // בדיקת משתני סביבה
  validateEnvironmentVariables();
  
  // אתחול Twilio client
  const client = twilio(accountSid, authToken);
  
  try {
    // שלב 1: חיפוש מספרים זמינים
    const availableNumbers = await searchAvailableTollFreeNumbers(client);
    
    // שלב 2: קניית המספר הראשון
    const purchasedNumber = await purchasePhoneNumber(
      client,
      availableNumbers[0].phoneNumber
    );
    
    // שלב 3: הוספה ל-Messaging Service
    await addToMessagingService(client, purchasedNumber.sid);
    
    // סיכום
    console.log('\n' + '='.repeat(60));
    console.log('🎉 התהליך הושלם בהצלחה!');
    console.log('='.repeat(60));
    console.log(`\n📞 המספר החדש שלך: ${purchasedNumber.phoneNumber}`);
    console.log(`🆔 SID: ${purchasedNumber.sid}`);
    console.log(`📨 המספר מוכן לשליחת הודעות דרך ה-Messaging Service\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('💥 התהליך נכשל');
    console.error('='.repeat(60));
    console.error('\nשגיאה:', error.message);
    
    if (error.code) {
      console.error('קוד שגיאה:', error.code);
    }
    
    if (error.moreInfo) {
      console.error('מידע נוסף:', error.moreInfo);
    }
    
    console.error('\n💡 טיפים לפתרון בעיות:');
    console.error('   - ודא שה-credentials נכונים');
    console.error('   - בדוק שיש לך זכויות Admin ב-Twilio');
    console.error('   - ודא שיש לך יתרה מספקת בחשבון');
    console.error('   - בדוק שה-Messaging Service SID נכון\n');
    
    process.exit(1);
  }
}

// הרצת הסקריפט
main();
