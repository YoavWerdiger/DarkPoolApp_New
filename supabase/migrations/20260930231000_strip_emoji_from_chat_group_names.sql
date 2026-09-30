-- שמות קבוצות בלי אימוג'י. הסימון ⁉ (U+2049) והדגלים לא נכנסים ל-Extended_Pictographic,
-- לכן הרצף בנוי מ-chr() ולא מ-escape של יוניקוד.
UPDATE public.chat_groups
SET
  name = btrim(regexp_replace(regexp_replace(
    name,
    '['
      || chr(127462) || '-' || chr(127487)
      || chr(127744) || '-' || chr(129791)
      || chr(9728) || '-' || chr(10175)
      || chr(65039) || chr(8205) || chr(8265) || chr(8252)
      || ']+',
    '',
    'g'
  ), '\s+', ' ', 'g')),
  updated_at = now()
WHERE name IS DISTINCT FROM btrim(regexp_replace(regexp_replace(
  name,
  '['
    || chr(127462) || '-' || chr(127487)
    || chr(127744) || '-' || chr(129791)
    || chr(9728) || '-' || chr(10175)
    || chr(65039) || chr(8205) || chr(8265) || chr(8252)
    || ']+',
  '',
  'g'
), '\s+', ' ', 'g'));
