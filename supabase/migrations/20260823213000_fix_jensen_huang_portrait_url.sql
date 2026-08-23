-- Wikimedia moved/removed old Jensen Huang portrait hash path (9/9e → 404).
-- Align DB with current commons cropped 2024 URL used by curated/known client maps.

UPDATE public.dark_pool_person_portraits
SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/59/Jensen_Huang_%28cropped%29_%282024%29.jpg',
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
   OR image_url LIKE '%9/9e/Jensen_Huang%'
   OR (
     kind = 'insider'
     AND ticker = 'NVDA'
     AND lower(COALESCE(display_name, lookup_name, '')) IN (
       'jensen huang',
       'huang jensen'
     )
   );

INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES
  (
    'NVDA:Huang',
    'insider',
    'Jensen Huang',
    'NVDA',
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Jensen_Huang_%28cropped%29_%282024%29.jpg',
    'known',
    'Jensen Huang',
    0,
    now()
  ),
  (
    'NVDA:Jensen Huang',
    'insider',
    'Jensen Huang',
    'NVDA',
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Jensen_Huang_%28cropped%29_%282024%29.jpg',
    'known',
    'Jensen Huang',
    0,
    now()
  ),
  (
    'jensen-huang',
    'insider',
    'Jensen Huang',
    'NVDA',
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Jensen_Huang_%28cropped%29_%282024%29.jpg',
    'known',
    'Jensen Huang',
    0,
    now()
  ),
  (
    'Jensen Huang',
    'insider',
    'Jensen Huang',
    'NVDA',
    'https://upload.wikimedia.org/wikipedia/commons/5/59/Jensen_Huang_%28cropped%29_%282024%29.jpg',
    'known',
    'Jensen Huang',
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

UPDATE public.dark_pool_featured_profiles
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/59/Jensen_Huang_%28cropped%29_%282024%29.jpg'
WHERE person_id IN ('NVDA:Huang', 'NVDA:Jensen Huang', 'jensen-huang', 'Jensen Huang')
   OR image_url LIKE '%9/9e/Jensen_Huang%'
   OR (
     ticker = 'NVDA'
     AND lower(name) IN ('jensen huang', 'huang jensen')
   );
