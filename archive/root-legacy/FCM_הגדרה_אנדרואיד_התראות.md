# תיקון: "Unable to retrieve the FCM server key" – הגדרת FCM V1 ב-Expo

השגיאה אומרת ש-**Expo** לא מקבל מ-Firebase את ה־credentials הנדרשים לשליחת התראות לאנדרואיד.  
הפתרון: להעלות **Google Service Account Key (FCM V1)** ל-**Expo/EAS** (לא ל-Supabase).

---

## ⚠️ "Key creation is not allowed on this service account"

אם ב-Firebase/Google Cloud אתה מקבל שגיאה כזו, הפרויקט כפוף **מדיניות ארגונית** שמונעת יצירת מפתחות ל-Service Account. יש שלוש אפשרויות:

### אפשרות 1: פרויקט Firebase חדש (חשבון אישי) – מומלץ

1. התחבר ל-[Firebase Console](https://console.firebase.google.com) עם **חשבון Google אישי** (לא חשבון ארגוני / Workspace).
2. **Create project** → שם חדש (למשל DarkPool-Push).
3. הוסף אפליקציית **Android** עם אותו **package name**: `com.darkpool.app`.
4. הורד **google-services.json** מהפרויקט החדש והחלף בפרויקט את הקובץ הקיים (או שים בשורש וציין ב-`app.json`).
5. באותו פרויקט Firebase החדש: **Project settings** → **Service accounts** → **Generate New Private Key** → הורדת ה-JSON.  
   בפרויקט אישי בדרך כלל **אין** את המגבלה על יצירת מפתחות.
6. העלה את קובץ ה-JSON ל-Expo (שלב 2 למטה).
7. **Build מחדש** לאנדרואיד (כי החלפת `google-services.json`) והתקן את ה-APK/AAB החדש.

כך ההתראות יעבדו עם הפרויקט החדש, בלי צורך לשנות מדיניות בארגון.

### אפשרות 2: מנהל הארגון יאשר או ייצור את המפתח

- אם הפרויקט תחת **Google Cloud Organization**, רק מנהל עם הרשאות **Organization Policy** יכול:
  - להסיר/לשנות את המגבלה **"Disable service account key creation"** ב-[Organization Policies](https://console.cloud.google.com/iam-admin/orgpolicies),  
  **או**
  - ליצור בעצמו את מפתח ה-Service Account, להוריד את קובץ ה-JSON ולתת לך (בצורה מאובטחת). אתה מעלה את ה-JSON ל-Expo כמו בשלב 2.

### אפשרות 3: Workload Identity / אין מפתח (לא רלוונטי ל-Expo)

Expo דורש קובץ JSON של Service Account key; אי אפשר להשתמש רק ב-Workload Identity בלי מפתח.  
אז בפועל הפתרון הוא **אפשרות 1** או **אפשרות 2**.

---

## שלב 1: יצירת מפתח ב-Firebase

1. היכנס ל־[Firebase Console](https://console.firebase.google.com) ובחר את הפרויקט של האפליקציה (אותו פרויקט שממנו הורדת את `google-services.json`).
2. **Project settings** (גלגל השיניים) → **Service accounts**.
3. בלשונית **Service accounts** לחץ **Generate New Private Key** → **Generate Key**.
4. יורד קובץ JSON – **שמור אותו במקום בטוח**.  
   זה מפתח רגיש – אל תעלה אותו ל-Git. (הוספנו אותו ל-.gitignore.)

---

## שלב 2: העלאת המפתח ל-Expo (EAS)

יש שתי דרכים:

### אופציה א': דרך האתר expo.dev

1. היכנס ל־[expo.dev](https://expo.dev) → הפרויקט **DarkPool**.
2. **Project settings** → **Credentials** (או ישירות: `https://expo.dev/accounts/darkpoolapp/projects/DarkPool/credentials`).
3. תחת **Android** בחר את ה־Application identifier (או הוסף אם אין).
4. תחת **Service Credentials** → **FCM V1 service account key** → **Add a service account key**.
5. **Upload new key** – העלה את קובץ ה-JSON שהורדת Firebase.
6. **Save**.

### אופציה ב': דרך הטרמינל (EAS CLI)

```bash
cd /Users/yoavwerdiger/DarkPoolApp_New-1
eas credentials
```

- בחר **Android** → **production** → **Google Service Account**.
- **Manage your Google Service Account Key for Push Notifications (FCM V1)**.
- **Set up a Google Service Account Key for Push Notifications (FCM V1)** → **Upload a new service account key**.
- בחר את קובץ ה-JSON שהורדת.

---

## שלב 3: וידוא

- **לא** צריך לעשות build מחדש לאפליקציה – ה-credentials נשמרים אצל Expo.
- נסה שוב לשלוח התראה (למשל Invoke ל־`send-push-notification` עם ה-userId שלך).

אם העלאת את המפתח נכון, השגיאה "Unable to retrieve the FCM server key" אמורה להיעלם וההתראות יישלחו.

---

## אם יש לך כבר Service Account ב-Google Cloud

אם יצרת בעבר Service Account (לא דרך "Generate New Private Key" ב-Firebase):

1. ב-[Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam) וודא ל-Service Account את התפקיד **Firebase Messaging API Admin**.
2. אחר כך העלה את קובץ ה-JSON של ה-Service Account ל-Expo כמו בשלב 2.

---

## סיכום

| מקום | מה עושים |
|------|----------|
| **Firebase Console** | Service accounts → Generate New Private Key → הורדת JSON |
| **expo.dev → Credentials → Android** | העלאת ה-JSON תחת FCM V1 service account key |
| **Supabase** | לא משנים כלום – הבעיה היא רק ב-Expo/FCM |

לאחר ההעלאה, נסה שוב לשלוח התראה.
