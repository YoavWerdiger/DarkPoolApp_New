# 🚀 הפעלה מהירה - מערכת התשלום

## שלב 1: הפעלת מסד הנתונים

1. **פתח את Supabase Dashboard**
2. **עבור ל-SQL Editor**
3. **העתק את כל התוכן מהקובץ:** `PAYMENT_DATABASE_COMPLETE.sql`
4. **הדבק ב-SQL Editor**
5. **לחץ על "Run"**

## שלב 2: העלאת Edge Functions

```bash
supabase functions deploy payment-callback
supabase functions deploy payment-success
```

## שלב 3: עדכון URLs

עדכן ב-`services/paymentService.ts`:

```typescript
successUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-success',
errorUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-success',
callbackUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-callback'
```

## שלב 4: הפעלת האפליקציה

```bash
npm start
```

## ✅ מה נוצר:

- **דף צ'קאאוט מקצועי** עם שדות פרטי אשראי
- **3 תוכניות מנוי** (חינם, פרימיום, פרו)
- **מערכת תשלום מלאה** עם CardCom
- **ניהול מנויים** אוטומטי
- **היסטוריית תשלומים**

## 🎯 בדיקה:

1. בחר תוכנית פרימיום
2. מלא פרטי כרטיס אשראי
3. השלם תשלום
4. ודא שהמנוי הופעל

---

**זמן הפעלה**: 10 דקות  
**רמת קושי**: קלה
