-- 🔧 הפעלת Realtime באופן אלטרנטיבי (אם Replication לא זמין)
-- הרץ את זה ב-Supabase SQL Editor

-- 1. ודא ש-REPLICA IDENTITY מוגדר (זה חובה!)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;

-- 2. אפשר Realtime ברמת הטבלאות (אם אפשרי)
-- הערה: זה עשוי לעבוד רק בגרסאות מסוימות של Supabase

-- בדוק אם realtime publication קיים
DO $$
BEGIN
  -- ניסיון להוסיף טבלאות ל-publication הקיים
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  RAISE NOTICE '✅ Added messages to realtime publication';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Could not add to publication: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channels';
  RAISE NOTICE '✅ Added channels to realtime publication';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Could not add to publication: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members';
  RAISE NOTICE '✅ Added channel_members to realtime publication';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  Could not add to publication: %', SQLERRM;
END $$;

-- 3. בדוק אילו טבלאות נמצאות ב-publication
SELECT 
  schemaname,
  tablename,
  'In realtime publication' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';

-- 4. בדוק אם publication בכלל קיים
SELECT 
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication
WHERE pubname = 'supabase_realtime';

-- תוצאות מצופות:
-- אם אין שגיאות = הכל טוב
-- אם יש שגיאה "publication does not exist" = צריך גישת admin או שהפיצ'ר לא זמין

