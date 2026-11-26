# רכישות בתוך האפליקציה (Apple / Google) — הקמה

במובייל כל מכירה של מנוי או קורס עוברת דרך App Store / Google Play. CardCom נשאר רק לווב.
הקוד מוכן; כדי שיעבוד צריך להקים את המוצרים בחנויות, להגדיר סודות ב-Supabase ולפרוס.

## 1. מזהי מוצרים (חייבים להיות בדיוק כך)

| מזהה בחנות | סוג | אצלנו |
|---|---|---|
| `com.darkpool.app.sub.monthly` | מנוי מתחדש, חודש | `monthly` |
| `com.darkpool.app.sub.quarterly` | מנוי מתחדש, 3 חודשים | `quarterly` |
| `com.darkpool.app.sub.yearly` | מנוי מתחדש, שנה | `yearly` |
| `com.darkpool.app.course.whales` | Non-Consumable (חד-פעמי) | `course:whales-course-1` |

המיפוי נמצא ב-`lib/iapProducts.ts` (אפליקציה) וב-`supabase/functions/_shared/iap.ts` (שרת). כל שינוי — בשני המקומות.

## 2. App Store Connect

1. Agreements, Tax, and Banking — לחתום על Paid Apps Agreement ולמלא בנק ומס. בלי זה המוצרים לא נטענים.
2. האפליקציה → Monetization → Subscriptions → קבוצת מנויים אחת (למשל "DarkPool Premium") עם שלושת המנויים. בתוך קבוצה אחת Apple מטפלת בשדרוג/שנמוך.
3. In-App Purchases → Non-Consumable עבור הקורס.
4. לכל מוצר: מחיר, שם ותיאור בעברית, וצילום מסך לבדיקה.
5. Users and Access → Integrations → **In-App Purchase** → Generate key. שומרים את Key ID, Issuer ID ואת קובץ ה-`.p8`.
6. App Information → **App Store Server Notifications** (V2), Production וגם Sandbox:
   `https://<project-ref>.supabase.co/functions/v1/iap-apple-notifications`
7. Certificates, Identifiers & Profiles → App ID `com.darkpool.app` → להפעיל **In-App Purchase** ו-**Sign in with Apple**.

## 3. Google Play Console

1. Payments profile מוגדר (Merchant).
2. Monetize → Subscriptions: שלושת המנויים, ובכל אחד base plan אחד שמתחדש אוטומטית.
3. Monetize → In-app products: מוצר `com.darkpool.app.course.whales`.
   (Google מאפשר ליצור מוצרים רק אחרי שהועלה בילד שמכיל את ספריית החיוב, אפילו ל-Internal testing.)
4. Google Cloud → Service account → מפתח JSON. ב-Play Console → Users and permissions → להזמין את המייל של ה-service account עם הרשאות **View financial data** ו-**Manage orders and subscriptions**.
5. Real-time developer notifications: Pub/Sub topic, ו-push subscription לכתובת:
   `https://<project-ref>.supabase.co/functions/v1/iap-google-notifications?secret=<סוד אקראי>`
   ובמסך Monetization setup לבחור את ה-topic.

## 4. Supabase

```bash
supabase db push   # טבלת iap_purchases (migration 20261126120000_iap_purchases.sql)

supabase secrets set \
  APPLE_IAP_KEY_ID=... \
  APPLE_IAP_ISSUER_ID=... \
  APPLE_IAP_PRIVATE_KEY="$(cat SubscriptionKey_XXXX.p8)" \
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(cat play-service-account.json)" \
  IAP_GOOGLE_PUSH_SECRET=<אותו סוד מה-URL של Pub/Sub>

supabase functions deploy iap-verify
supabase functions deploy iap-apple-notifications --no-verify-jwt
supabase functions deploy iap-google-notifications --no-verify-jwt
```

ב-Authentication → Providers להפעיל **Apple** (Client ID = `com.darkpool.app`).

## 5. איך זה עובד

1. האפליקציה פותחת את חלון התשלום של החנות (`services/iapService.ts`), עם מזהה המשתמש (`appAccountToken` / `obfuscatedAccountId`).
2. הרכישה נשלחת ל-`iap-verify`, שמושך את המצב מ-App Store Server API / Google Play Developer API — לא סומך על הלקוח.
3. השרת כותב `iap_purchases`, ומעדכן `users.subscription_*` + `user_subscriptions` (מנוי) או `course_purchases` (קורס).
4. רק אחרי שהשרת שמר, האפליקציה קוראת ל-`finishTransaction` (בגוגל: בלי acknowledge תוך 3 ימים — החזר כספי אוטומטי; השרת גם עושה acknowledge).
5. חידושים, ביטולים, החזרים ו-grace period מגיעים ל-`iap-*-notifications`, שגם הן מושכות את המצב מחדש מהחנות.
6. רכישה שמשויכת למשתמש אחד לא תיפתח לחשבון אחר (409 `owned_by_other_account`).

## 6. בדיקה

- iOS: TestFlight עם Sandbox Apple ID (Settings → App Store → Sandbox Account). מנויים מתחדשים כל כמה דקות.
- Android: Internal testing + License testers ב-Play Console.
- לבדוק: רכישה, ביטול והמתנה לפקיעה, שחזור רכישות במכשיר שני, החזר (Sandbox), ורכישה מחשבון אחר עם אותו Apple ID.
- הכפתור «שחזור רכישות» נמצא במסך המסלולים (חובה לפי Apple).
