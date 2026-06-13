-- מומלצים + איחוד politician_id ל-bioguide (נתונים אמיתיים בלבד)

-- איחוד שורות קונגרס: UUID → bioguide כשיש כפילות לפי שם
WITH bio AS (
  SELECT
    politician_name,
    max(CASE WHEN politician_id ~ '^[A-Z][0-9]{6}$' THEN politician_id END) AS bioguide
  FROM public.dark_pool_congress_trades
  GROUP BY politician_name
  HAVING count(DISTINCT politician_id) > 1
)
UPDATE public.dark_pool_congress_trades t
SET politician_id = b.bioguide
FROM bio b
WHERE t.politician_name = b.politician_name
  AND b.bioguide IS NOT NULL
  AND t.politician_id !~ '^[A-Z][0-9]{6}$';

-- Pelosi (P000197) אין לה עסקאות ב-DB — מחליפים בפוליטיקאי עם הכי הרבה עסקאות
UPDATE public.dark_pool_featured_profiles
SET
  name = 'Josh Gottheimer',
  subtitle = 'House · דמוקרטית · NJ',
  person_id = 'G000583',
  image_url = 'https://unitedstates.github.io/images/congress/225x275/G000583.jpg'
WHERE kind = 'politician'
  AND person_id = 'P000197'
  AND NOT EXISTS (
    SELECT 1 FROM public.dark_pool_congress_trades WHERE politician_id = 'P000197'
  );
