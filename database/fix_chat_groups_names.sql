-- ============================================
-- עדכון שמות קבוצות רשמיות + הוספת חדרים חדשים
-- ============================================
-- מריצים ב-Supabase SQL Editor על DB קיים.
-- משמר IDs של 9 החדרים הוותיקים; מוסיף 3 חדשים.
-- ============================================

-- Rename in place (IDs 001–009)
UPDATE public.chat_groups SET name = 'הכרזות', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.chat_groups SET name = 'דיונים - כללי 🗣️', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000002';

UPDATE public.chat_groups SET name = 'ניתוחים ורעיונות שלכם 🗣️', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE public.chat_groups SET name = 'דיוני - פניסטוקס 🚨🗣️', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000004';

UPDATE public.chat_groups SET name = 'שאלות תשובות ⁉️🗣️', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000005';

UPDATE public.chat_groups SET name = 'מסחר יומי 🌟🔇', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000006';

-- ...007 (חדשות מתפרצות) הוסר — ראו supabase/migrations/070_remove_breaking_news_chat_group.sql

UPDATE public.chat_groups SET name = 'סווינגים והשקעות 🌟🔇', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000008';

UPDATE public.chat_groups SET name = 'פניסטוקס (סיכון גבוה)🌟🔇', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000009';

-- New official rooms (IDs 00a–00c)
INSERT INTO public.chat_groups (id, name, description, avatar_url, created_by, settings)
VALUES
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
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify
SELECT id, name
FROM public.chat_groups
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000c'
)
ORDER BY id;
