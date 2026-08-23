-- Wikimedia renamed/removed old Tim Cook + Cathie Wood portrait files (404).
-- Align DB with current commons URLs used by curated/known client maps.

UPDATE public.dark_pool_person_portraits
SET
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg',
  source = 'known',
  display_name = COALESCE(display_name, 'Tim Cook'),
  last_error = NULL,
  fail_count = 0,
  resolved_at = now(),
  updated_at = now()
WHERE person_id IN ('AAPL:Cook', 'tim-cook', 'Tim Cook')
   OR (
     kind = 'insider'
     AND lower(COALESCE(display_name, lookup_name, '')) IN ('tim cook', 'cook tim')
     AND image_url LIKE '%Tim_Cook_2009%'
   );

INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES (
  'AAPL:Cook',
  'insider',
  'Tim Cook',
  'AAPL',
  'https://upload.wikimedia.org/wikipedia/commons/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg',
  'known',
  'Tim Cook',
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
  image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg',
  source = 'known',
  display_name = COALESCE(display_name, 'Cathie Wood'),
  last_error = NULL,
  fail_count = 0,
  resolved_at = now(),
  updated_at = now()
WHERE person_id IN ('1697748', 'cathie-wood', 'Cathie Wood')
   OR image_url LIKE '%Cathie_Wood_%28cropped%29%'
   OR image_url LIKE '%Cathie_Wood_(cropped)%';

INSERT INTO public.dark_pool_person_portraits (
  person_id, kind, display_name, ticker, image_url, source, lookup_name, fail_count, resolved_at
)
VALUES (
  '1697748',
  'fund_manager',
  'Cathie Wood',
  NULL,
  'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg',
  'known',
  'Cathie Wood',
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

UPDATE public.dark_pool_featured_profiles
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg'
WHERE person_id = 'AAPL:Cook'
   OR image_url LIKE '%Tim_Cook_2009%';

UPDATE public.dark_pool_featured_profiles
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg'
WHERE person_id = '1697748'
   OR image_url LIKE '%Cathie_Wood_%28cropped%29%'
   OR image_url LIKE '%Cathie_Wood_(cropped)%';

UPDATE public.dark_pool_fund_managers
SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg'
WHERE cik = '1697748'
   OR image_url LIKE '%Cathie_Wood_%28cropped%29%'
   OR image_url LIKE '%Cathie_Wood_(cropped)%';
