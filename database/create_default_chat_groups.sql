-- ============================================
-- יצירת קבוצות צ'אט קבועות
-- ============================================
-- 11 קבוצות ברירת מחדל לאפליקציית DarkPool
-- ============================================

-- מחיקת קבוצות קיימות (אם צריך)
-- DELETE FROM public.chat_groups;

-- יצירת קבוצות קבועות
INSERT INTO public.chat_groups (id, name, description, avatar_url, created_by, settings) VALUES

-- 1. הכרזות (חובה לכולם)
(
  '00000000-0000-0000-0000-000000000001',
  'הכרזות',
  'הודעות חשובות ועדכונים רשמיים מהצוות',
  null,
  (SELECT id FROM auth.users LIMIT 1),
  jsonb_build_object(
    'muteNotifications', false,
    'onlyAdminsCanSend', true,
    'onlyAdminsCanEditInfo', true,
    'showJoinMessages', false,
    'allowMembersToAddOthers', false
  )
),

-- 2. דיונים - כללי
(
  '00000000-0000-0000-0000-000000000002',
  'דיונים - כללי 🗣️',
  'דיונים כלליים על שוק ההון והמסחר',
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

-- 3. שאלות תשובות
(
  '00000000-0000-0000-0000-000000000005',
  'שאלות תשובות ⁉️🗣️',
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

-- 4. דיוני - פניסטוקס
(
  '00000000-0000-0000-0000-000000000004',
  'דיוני - פניסטוקס 🚨🗣️',
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

-- 5. סווינגים והשקעות
(
  '00000000-0000-0000-0000-000000000008',
  'סווינגים והשקעות 🌟🔇',
  'אסטרטגיות swing trading והשקעות ארוכות טווח',
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

-- 6. ניתוחים ורעיונות שלכם
(
  '00000000-0000-0000-0000-000000000003',
  'ניתוחים ורעיונות שלכם 🗣️',
  'ניתוחים טכניים ופונדמנטליים ורעיונות מהקהילה',
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

-- 7. רווחים והצלחות
(
  '00000000-0000-0000-0000-00000000000a',
  'רווחים והצלחות 💰',
  'שיתוף רווחים והצלחות מסחריות מהקהילה',
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

-- 8. שאלות בלייבים
(
  '00000000-0000-0000-0000-00000000000b',
  'שאלות בלייבים 🎥🗣️',
  'שאלות ותשובות במהלך לייבים',
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

-- 9. מסחר יומי
(
  '00000000-0000-0000-0000-000000000006',
  'מסחר יומי 🌟🔇',
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

-- 10. בורסה ישראלית
(
  '00000000-0000-0000-0000-00000000000c',
  'בורסה ישראלית 🇮🇱🗣️',
  'דיונים על מסחר בבורסה הישראלית',
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

-- 11. פניסטוקס (סיכון גבוה)
(
  '00000000-0000-0000-0000-000000000009',
  'פניסטוקס (סיכון גבוה)🌟🔇',
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
-- DONE! 11 קבוצות מוכנות!
-- ============================================
-- משתמשים חדשים יצטרפו אוטומטית ל-"הכרזות" ו-"דיונים כללי"
-- דרך טריגר או בקוד ההרשמה
-- (חדר "חדשות מתפרצות" ...007 הוסר — ראו migration 070)
-- ============================================
