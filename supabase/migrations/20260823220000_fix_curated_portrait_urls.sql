-- Fix curated explore portraits: dead Wikimedia paths (Ackman/Nadella/Ellison 404)
-- + replace odd Jensen Huang 2024 crop with a normal headshot-style portrait.

-- Jensen Huang — flattering portrait crop
UPDATE public.dark_pool_person_portraits
SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Jensen_Huang_%28cropped%29.jpg',
  source = 'known',
  display_name = COALESCE(display_name, 'Jensen Huang'),
  last_error = NULL,
  fail_count = 0,
  resolved_at = now(),
  updated_at = now()
WHERE person_id IN (
    'NVDA:Huang',
    'NVDA:Jensen Huang',
    'NVDA:HUANG Jensen',
    'jensen-huang',
    'Jensen Huang'
  )
   OR image_url LIKE '%Jensen_Huang_%28cropped%29_%282024%29%'
   OR image_url LIKE '%9/9e/Jensen_Huang%';

INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES
  (
    'NVDA:Huang', 'insider', 'Jensen Huang', 'NVDA',
    'https://upload.wikimedia.org/wikipedia/commons/c/c4/Jensen_Huang_%28cropped%29.jpg',
    'known', 'Jensen Huang', 0, now()
  ),
  (
    'NVDA:Jensen Huang', 'insider', 'Jensen Huang', 'NVDA',
    'https://upload.wikimedia.org/wikipedia/commons/c/c4/Jensen_Huang_%28cropped%29.jpg',
    'known', 'Jensen Huang', 0, now()
  )
ON CONFLICT (person_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  display_name = EXCLUDED.display_name,
  ticker = EXCLUDED.ticker,
  lookup_name = EXCLUDED.lookup_name,
  fail_count = 0,
  last_error = NULL,
  resolved_at = now(),
  updated_at = now();

-- Bill Ackman — old Bill_Ackman_2019.jpg is 404
UPDATE public.dark_pool_person_portraits
SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg',
  source = 'known',
  display_name = COALESCE(display_name, 'Bill Ackman'),
  kind = 'fund_manager',
  last_error = NULL,
  fail_count = 0,
  resolved_at = now(),
  updated_at = now()
WHERE person_id IN ('1336528', 'bill-ackman', 'Bill Ackman')
   OR image_url LIKE '%Bill_Ackman_2019%';

INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES (
  '1336528',
  'fund_manager',
  'Bill Ackman',
  NULL,
  'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg',
  'known',
  'Bill Ackman',
  0,
  now()
)
ON CONFLICT (person_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  display_name = EXCLUDED.display_name,
  lookup_name = EXCLUDED.lookup_name,
  fail_count = 0,
  last_error = NULL,
  resolved_at = now(),
  updated_at = now();

-- Satya Nadella — old 0/0c/Satya_Nadella.jpg is 404
INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES (
  'MSFT:Nadella',
  'insider',
  'Satya Nadella',
  'MSFT',
  'https://upload.wikimedia.org/wikipedia/commons/4/4a/Satya_Nadella_%28cropped%29.jpg',
  'known',
  'Satya Nadella',
  0,
  now()
)
ON CONFLICT (person_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  display_name = EXCLUDED.display_name,
  ticker = EXCLUDED.ticker,
  lookup_name = EXCLUDED.lookup_name,
  fail_count = 0,
  last_error = NULL,
  resolved_at = now(),
  updated_at = now();

UPDATE public.dark_pool_person_portraits
SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Satya_Nadella_%28cropped%29.jpg',
  source = 'known',
  last_error = NULL,
  fail_count = 0,
  resolved_at = now(),
  updated_at = now()
WHERE image_url LIKE '%0/0c/Satya_Nadella.jpg%'
   OR (
     kind = 'insider'
     AND lower(COALESCE(display_name, lookup_name, '')) = 'satya nadella'
   );

-- Larry Ellison — old 0/00/Larry_Ellison_on_stage.jpg is 404
INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES (
  'ORCL:Ellison',
  'insider',
  'Larry Ellison',
  'ORCL',
  'https://upload.wikimedia.org/wikipedia/commons/0/0e/Larry_Ellison_picture_%28cropped%29.png',
  'known',
  'Larry Ellison',
  0,
  now()
)
ON CONFLICT (person_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  display_name = EXCLUDED.display_name,
  ticker = EXCLUDED.ticker,
  lookup_name = EXCLUDED.lookup_name,
  fail_count = 0,
  last_error = NULL,
  resolved_at = now(),
  updated_at = now();

UPDATE public.dark_pool_person_portraits
SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Larry_Ellison_picture_%28cropped%29.png',
  source = 'known',
  last_error = NULL,
  fail_count = 0,
  resolved_at = now(),
  updated_at = now()
WHERE image_url LIKE '%0/00/Larry_Ellison_on_stage.jpg%'
   OR (
     kind = 'insider'
     AND lower(COALESCE(display_name, lookup_name, '')) = 'larry ellison'
   );

-- Ensure other curated insiders/funds exist with working URLs
INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES
  (
    'TSLA:Musk', 'insider', 'Elon Musk', 'TSLA',
    'https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg',
    'known', 'Elon Musk', 0, now()
  ),
  (
    'META:Zuckerberg', 'insider', 'Mark Zuckerberg', 'META',
    'https://upload.wikimedia.org/wikipedia/commons/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg',
    'known', 'Mark Zuckerberg', 0, now()
  ),
  (
    '1067983', 'fund_manager', 'Warren Buffett', NULL,
    'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg',
    'known', 'Warren Buffett', 0, now()
  )
ON CONFLICT (person_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  display_name = COALESCE(EXCLUDED.display_name, public.dark_pool_person_portraits.display_name),
  ticker = COALESCE(EXCLUDED.ticker, public.dark_pool_person_portraits.ticker),
  lookup_name = COALESCE(EXCLUDED.lookup_name, public.dark_pool_person_portraits.lookup_name),
  fail_count = 0,
  last_error = NULL,
  resolved_at = now(),
  updated_at = now();

-- Featured + fund managers tables
UPDATE public.dark_pool_featured_profiles
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Jensen_Huang_%28cropped%29.jpg'
WHERE person_id IN ('NVDA:Huang', 'NVDA:Jensen Huang')
   OR image_url LIKE '%Jensen_Huang_%28cropped%29_%282024%29%'
   OR image_url LIKE '%9/9e/Jensen_Huang%';

UPDATE public.dark_pool_featured_profiles
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg'
WHERE person_id = '1336528'
   OR image_url LIKE '%Bill_Ackman_2019%';

UPDATE public.dark_pool_fund_managers
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg'
WHERE cik = '1336528'
   OR image_url LIKE '%Bill_Ackman_2019%';
