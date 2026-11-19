-- Repair news rows saved with the raw GPT JSON as label/text
-- (Hebrew acronyms like נאסד"ק broke JSON parsing in n8n).
-- 1) a " between two Hebrew letters -> gershayim ״
-- 2) extract "label" / "text" with a regex
-- 3) rows the model marked relevant=false are deleted

with broken as (
  select id,
         regexp_replace(coalesce(label, ''), '([א-ת])"([א-ת])', '\1״\2', 'g') as l
    from public.app_news_clean
   where label like '{%"relevant"%'
),
parsed as (
  select id,
         (regexp_match(l, '"relevant"\s*:\s*(true|false)'))[1] as relevant,
         (regexp_match(l, '"label"\s*:\s*"(.*?)"\s*,\s*"text"'))[1] as new_label,
         (regexp_match(l, '"text"\s*:\s*"(.*?)"\s*}\s*$'))[1] as new_text
    from broken
)
delete from public.app_news_clean n
 using parsed p
 where n.id = p.id
   and p.relevant = 'false';

with broken as (
  select id,
         regexp_replace(coalesce(label, ''), '([א-ת])"([א-ת])', '\1״\2', 'g') as l
    from public.app_news_clean
   where label like '{%"relevant"%'
),
parsed as (
  select id,
         (regexp_match(l, '"label"\s*:\s*"(.*?)"\s*,\s*"text"'))[1] as new_label,
         (regexp_match(l, '"text"\s*:\s*"(.*?)"\s*}\s*$'))[1] as new_text
    from broken
)
update public.app_news_clean n
   set label = coalesce(nullif(trim(p.new_label), ''), left(p.new_text, 120)),
       text  = coalesce(nullif(trim(replace(p.new_text, '\n', E'\n')), ''), p.new_label)
  from parsed p
 where n.id = p.id
   and (p.new_label is not null or p.new_text is not null);

-- whatever still could not be parsed is removed (never show raw JSON)
delete from public.app_news_clean
 where label like '{%"relevant"%';
