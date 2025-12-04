-- ============================================
-- יצירת קבוצות צ'אט קבועות
-- ============================================
-- 9 קבוצות ברירת מחדל לאפליקציית DarkPool
-- ============================================

-- מחיקת קבוצות קיימות (אם צריך)
-- DELETE FROM public.chat_groups;

-- יצירת קבוצות קבועות
INSERT INTO public.chat_groups (id, name, description, avatar_url, created_by, settings) VALUES

-- 1. הכרזות (חובה לכולם)
(
  '00000000-0000-0000-0000-000000000001',
  '🔔 הכרזות',
  'הודעות חשובות ועדכונים רשמיים מהצוות',
  null,
  (SELECT id FROM auth.users LIMIT 1), -- אדמין ראשון
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', true,  -- רק אדמינים יכולים לשלוח
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', false,
    'allowMembersToAddOthers', false
  )
),

-- 2. דיונים - כללי (חובה לכולם)
(
  '00000000-0000-0000-0000-000000000002',
  '💬 דיונים - כללי',
  'דיונים כלליים על שוק ההון והמסחר',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,  -- כולם יכולים לשלוח
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
),

-- 3. נטו ניתוחים
(
  '00000000-0000-0000-0000-000000000003',
  '📊 נטו ניתוחים!',
  'ניתוחים טכניים ופונדמנטליים של מניות',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
),

-- 4. דיוני - פניסטוקס
(
  '00000000-0000-0000-0000-000000000004',
  '💰 דיוני - פניסטוקס',
  'דיונים על מניות פניסטוקס',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
),

-- 5. שאלות ותשובות בשוק
(
  '00000000-0000-0000-0000-000000000005',
  '❓ שאלות ותשובות בשוק',
  'מקום לשאול שאלות ולקבל תשובות מהקהילה',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
),

-- 6. עסקאות מסחר יומי
(
  '00000000-0000-0000-0000-000000000006',
  '📈 עסקאות מסחר יומי',
  'שיתוף עסקאות ואסטרטגיות מסחר יומי',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
),

-- 7. חדשות מתפרצות
(
  '00000000-0000-0000-0000-000000000007',
  '⚡ חדשות מתפרצות',
  'עדכונים מהירים וחדשות בזמן אמת',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', true,  -- רק אדמינים
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', false,
    'allowMembersToAddOthers', false
  )
),

-- 8. סווינגים וסטאפים
(
  '00000000-0000-0000-0000-000000000008',
  '🔄 סווינגים וסטאפים',
  'אסטרטגיות swing trading ו-stop loss',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
),

-- 9. מסחר פניסטוקס - סיכון גבוה
(
  '00000000-0000-0000-0000-000000000009',
  '⚠️ מסחר פניסטוקס - סיכון גבוה',
  'מסחר במניות פניסטוקס - אזהרה: סיכון גבוה!',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', false,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', true,
    'allowMembersToAddOthers', false
  )
)

ON CONFLICT (id) DO NOTHING;

-- הוספת כל המשתמשים הקיימים לקבוצות חובה (הכרזות ודיונים כללי)
INSERT INTO public.chat_group_members (group_id, user_id, role, notifications_enabled)
SELECT 
  '00000000-0000-0000-0000-000000000001', -- הכרזות
  u.id,
  'member',
  true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_group_members 
  WHERE group_id = '00000000-0000-0000-0000-000000000001' 
  AND user_id = u.id
);

INSERT INTO public.chat_group_members (group_id, user_id, role, notifications_enabled)
SELECT 
  '00000000-0000-0000-0000-000000000002', -- דיונים כללי
  u.id,
  'member',
  true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_group_members 
  WHERE group_id = '00000000-0000-0000-0000-000000000002' 
  AND user_id = u.id
);

-- ============================================
-- DONE! 9 קבוצות מוכנות!
-- ============================================
-- משתמשים חדשים יצטרפו אוטומטית ל-"הכרזות" ו-"דיונים כללי"
-- דרך טריגר או בקוד ההרשמה
-- ============================================


