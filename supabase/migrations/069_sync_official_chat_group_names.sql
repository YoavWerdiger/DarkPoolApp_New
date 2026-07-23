-- Sync official chat group names (12 rooms). Rename in place; insert missing rooms.
-- Safe to re-run: updates names by fixed UUID; upserts new rooms.

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

UPDATE public.chat_groups SET name = 'חדשות מתפרצות 🌟🔇', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000007';

UPDATE public.chat_groups SET name = 'סווינגים והשקעות 🌟🔇', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000008';

UPDATE public.chat_groups SET name = 'פניסטוקס (סיכון גבוה)🌟🔇', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000009';

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
