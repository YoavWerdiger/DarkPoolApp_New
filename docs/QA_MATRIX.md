# מטריצת QA (פריט 48)

כל מסך × iOS / Android × עברית / אנגלית × בהיר / כהה = 8 תאים. מסמנים ✅ / ❌ (עם קישור לבאג) / — (לא רלוונטי).

## מה בודקים בכל תא

1. **כיוון:** בעברית הכל מימין, באנגלית משמאל; אייקוני חץ / חזרה מתהפכים; מספרים ומחירים לא «קופצים» בתוך טקסט עברי.
2. **ערכת נושא:** אין טקסט שחור על כהה / לבן על בהיר; כרטיסים, מפרידים ושיטים בצבע הערכה.
3. **טקסט:** בלי חיתוך / גלישה — גם בהגדלת גופן מקסימלית של המערכת (×1.3) ובשמות ארוכים.
4. **Safe area:** שום דבר מתחת לנוץ׳ / ל-Dynamic Island / לסרגל הניווט של אנדרואיד.
5. **מצבים:** טעינה (שלד), ריק (EmptyState), שגיאה (ErrorState + נסה שוב), אין חיבור (באנר).
6. **מקלדת:** שדות לא מוסתרים; Autofill עובד (אימייל, סיסמה, קוד SMS).
7. **מחירים:** ▲▼ / +/− ליד צבע ירוק / אדום; תווית «מושהה» כשרלוונטי; דיסקליימר במסכי תיק / עסקה.

## המלצה

אנגלית וערבית מתורגמות אוטומטית (`*.auto.json`). עד שעוברות את המטריצה — להסתיר את בורר השפה, או להשאיר רק עברית בגרסה הראשונה בחנות.

## אדמין

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `AdminCardCom` | | | | | | | | |
| `AdminCourseEdit` | | | | | | | | |
| `AdminCourses` | | | | | | | | |
| `AdminDashboard` | | | | | | | | |
| `AdminGroups` | | | | | | | | |
| `AdminPayments` | | | | | | | | |
| `AdminPush` | | | | | | | | |
| `AdminReports` | | | | | | | | |
| `AdminTickets` | | | | | | | | |
| `AdminUsers` | | | | | | | | |

## שורש

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `AddStory` | | | | | | | | |
| `PublicProfile` | | | | | | | | |
| `StoryViewer` | | | | | | | | |

## כניסה

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `ForgotPassword` | | | | | | | | |
| `ForgotPasswordNew` | | | | | | | | |
| `ForgotPasswordOtp` | | | | | | | | |
| `Login` | | | | | | | | |

## צ׳אט

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `ChatGroup` | | | | | | | | |
| `ChatGroupInfo` | | | | | | | | |
| `ChatGroupSettings` | | | | | | | | |
| `ChatGroupStarredMessages` | | | | | | | | |
| `ChatGroupsList` | | | | | | | | |
| `GroupMediaGallery` | | | | | | | | |
| `PrivacySupport` | | | | | | | | |
| `SavedMedia` | | | | | | | | |
| `ShareToChat` | | | | | | | | |

## דארק פול

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `DarkPoolExplore` | | | | | | | | |
| `DarkPoolFeed` | | | | | | | | |
| `DarkPoolFollowing` | | | | | | | | |
| `DarkPoolHome` | | | | | | | | |
| `DarkPoolInvestor` | | | | | | | | |
| `DarkPoolPosition` | | | | | | | | |
| `DarkPoolSearch` | | | | | | | | |
| `DarkPoolTicker` | | | | | | | | |
| `DarkPoolTradeDetail` | | | | | | | | |

## יומן מסחר

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `AddTrade` | | | | | | | | |
| `JournalMain` | | | | | | | | |
| `TradeDetail` | | | | | | | | |

## אקדמיה

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `CourseCheckout` | | | | | | | | |
| `CourseComingSoonScreen` | | | | | | | | |
| `CourseDetailScreen` | | | | | | | | |
| `CoursePreviewScreen` | | | | | | | | |
| `CoursesScreen` | | | | | | | | |
| `LearningScreen` | | | | | | | | |
| `LessonPlayerScreen` | | | | | | | | |
| `MyLearningScreen` | | | | | | | | |
| `MyNotesScreen` | | | | | | | | |

## מסכים ראשיים (תפריט צדדי)

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `MarketsHeatmap` | | | | | | | | |
| `News` | | | | | | | | |
| `NewsCalendar` | | | | | | | | |
| `NewsEarnings` | | | | | | | | |
| `Tweets` | | | | | | | | |
| `Watchlist` | | | | | | | | |

## הרשמה

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `CreditCardCheckout` | | | | | | | | |
| `RegistrationAge` | | | | | | | | |
| `RegistrationEmail` | | | | | | | | |
| `RegistrationEmailVerification` | | | | | | | | |
| `RegistrationExperience` | | | | | | | | |
| `RegistrationName` | | | | | | | | |
| `RegistrationPassword` | | | | | | | | |
| `RegistrationPhone` | | | | | | | | |
| `RegistrationPhoneVerification` | | | | | | | | |
| `RegistrationPlatform` | | | | | | | | |
| `RegistrationPortfolio` | | | | | | | | |
| `RegistrationProfileImage` | | | | | | | | |
| `RegistrationSummary` | | | | | | | | |
| `RegistrationTrack` | | | | | | | | |
| `RegistrationTradingFocus` | | | | | | | | |

## תיקים

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `AddTransaction` | | | | | | | | |
| `ConnectBroker` | | | | | | | | |
| `CreatePortfolio` | | | | | | | | |
| `ImportTransactions` | | | | | | | | |
| `PortfolioDetail` | | | | | | | | |
| `PortfoliosHub` | | | | | | | | |
| `SelectBrokerAccount` | | | | | | | | |

## פרופיל והגדרות

| מסך | iOS · עב · בהיר | iOS · עב · כהה | iOS · EN · בהיר | iOS · EN · כהה | Android · עב · בהיר | Android · עב · כהה | Android · EN · בהיר | Android · EN · כהה |
|---|---|---|---|---|---|---|---|---|
| `Billing` | | | | | | | | |
| `ChangePassword` | | | | | | | | |
| `CompleteProfile` | | | | | | | | |
| `ContactSupport` | | | | | | | | |
| `CreditCardCheckout` | | | | | | | | |
| `DeleteAccount` | | | | | | | | |
| `EditProfile` | | | | | | | | |
| `InvoiceDocumentPreview` | | | | | | | | |
| `LegalWebView` | | | | | | | | |
| `Notifications` | | | | | | | | |
| `ProfileMain` | | | | | | | | |
| `Settings` | | | | | | | | |
| `SubscriptionPlans` | | | | | | | | |
| `SubscriptionWelcome` | | | | | | | | |
