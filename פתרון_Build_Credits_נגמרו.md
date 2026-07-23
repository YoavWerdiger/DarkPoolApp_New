# ⚠️ פתרון: Build Credits נגמרו

## הבעיה

**ה-build credits החודשיים נגמרו!**

```
You've used 100% of your included build credits for this month.
Additional usage beyond your limit will be charged at pay-as-you-go rates.
```

---

## 🔧 פתרונות

### פתרון 1: Preview Build (חינם או זול יותר)

**Preview Build** יכול להיות זול יותר מ-Development Build:

```bash
eas build --platform android --profile preview
```

**זה יבנה:**
- APK לבדיקות
- כולל תמיכה בהתראות Push
- **ייתכן שזה עדיין בחינם או זול יותר**

---

### פתרון 2: Production Build (אופציה נוספת)

אם Preview Build גם עולה כסף, אפשר לבנות Production Build:

```bash
eas build --platform android --profile production
```

**⚠️ זה יוצר AAB (לא APK)** - צריך להעלות ל-Google Play Console (Internal Testing) או להמיר ל-APK.

---

### פתרון 3: בניית APK מקומי (אם יש Android Studio)

אם יש לך Android Studio, אפשר לבנות APK מקומי:

1. **פתח את הפרויקט ב-Android Studio**
2. **בנה APK:**
   - Build > Generate Signed Bundle / APK
   - בחר APK
   - בנה

**ראה:** `BUILD_WITH_ANDROID_STUDIO.md`

---

### פתרון 4: שיפור EAS (תשלום)

**אם אתה רוצה להמשיך להשתמש ב-EAS:**

1. **היכנס ל-EAS Dashboard:**
   - https://expo.dev/accounts/darkpoolapp/settings/billing

2. **שדרג תוכנית:**
   - EAS Build Plus
   - או שלם pay-as-you-go

3. **המשך לבנות:**
   ```bash
   eas build --platform android --profile development
   ```

---

## ✅ מה כבר עשינו

✅ התקנו `expo-dev-client`
✅ יש הגדרות `development` ב-`eas.json`
✅ הכל מוכן לבנייה

**חסר רק:** Build Credits! 💰

---

## 💡 המלצה

**אפשרות 1: נסה Preview Build (מהיר)**
```bash
eas build --platform android --profile preview
```

**אפשרות 2: אם יש Android Studio - בנייה מקומית**
- מהיר יותר
- חינמי
- ראה `BUILD_WITH_ANDROID_STUDIO.md`

**אפשרות 3: חכה לחודש הבא** (אם אתה ב-free plan)
- Build credits מתאפסים כל חודש

---

## 📝 הערות

- **Development Build** = חינמי עד הגבלת quota
- **Preview Build** = יכול להיות זול יותר
- **Production Build** = יכול להיות יקר יותר
- **בנייה מקומית** = חינמי אבל דורש Android Studio

---

**איזו אפשרות אתה מעדיף?** 🤔



