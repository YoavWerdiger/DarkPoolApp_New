-- Curated explore: Quiver politicians with real trades/portfolios + 13F fund managers.
-- Deactivate noise (Form4 SPVs etc.); keep user follows untouched.

UPDATE public.dark_pool_featured_profiles
SET is_active = FALSE
WHERE person_id NOT IN (
  '888dc73f-f1eb-485a-a241-80657aaaaff9',
  'P000197',
  'C001114',
  'M000355',
  'G000583',
  'C001098',
  'M001218',
  'B001236',
  'M001217',
  'S000168',
  '1067983',
  '1697748',
  '1336528'
);

INSERT INTO public.dark_pool_featured_profiles
  (sort_order, name, subtitle, image_url, person_id, kind, ticker, is_active)
VALUES
  (0, 'Donald Trump', 'נשיא · רפובליקני',
   'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg',
   '888dc73f-f1eb-485a-a241-80657aaaaff9', 'politician', NULL, TRUE),
  (1, 'Nancy Pelosi', 'בית הנציגים · דמוקרטית',
   'https://unitedstates.github.io/images/congress/225x275/P000197.jpg',
   'P000197', 'politician', NULL, TRUE),
  (2, 'John Curtis', 'Senate · רפובליקני',
   'https://unitedstates.github.io/images/congress/225x275/C001114.jpg',
   'C001114', 'politician', NULL, TRUE),
  (3, 'Mitch McConnell', 'Senate · רפובליקני',
   'https://unitedstates.github.io/images/congress/225x275/M000355.jpg',
   'M000355', 'politician', NULL, TRUE),
  (4, 'Josh Gottheimer', 'בית הנציגים · דמוקרט',
   'https://unitedstates.github.io/images/congress/225x275/G000583.jpg',
   'G000583', 'politician', NULL, TRUE),
  (5, 'Ted Cruz', 'Senate · רפובליקני',
   'https://unitedstates.github.io/images/congress/225x275/C001098.jpg',
   'C001098', 'politician', NULL, TRUE),
  (6, 'Rich McCormick', 'בית הנציגים · רפובליקני',
   'https://unitedstates.github.io/images/congress/225x275/M001218.jpg',
   'M001218', 'politician', NULL, TRUE),
  (7, 'John Boozman', 'Senate · רפובליקני',
   'https://unitedstates.github.io/images/congress/225x275/B001236.jpg',
   'B001236', 'politician', NULL, TRUE),
  (8, 'Jared Moskowitz', 'בית הנציגים · דמוקרט',
   'https://unitedstates.github.io/images/congress/225x275/M001217.jpg',
   'M001217', 'politician', NULL, TRUE),
  (9, 'Maria Elvira Salazar', 'בית הנציגים · רפובליקנית',
   'https://unitedstates.github.io/images/congress/225x275/S000168.jpg',
   'S000168', 'politician', NULL, TRUE),
  (10, 'Warren Buffett', 'Berkshire Hathaway · 13F',
   'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg',
   '1067983', 'fund_manager', NULL, TRUE),
  (11, 'Cathie Wood', 'ARK Invest · 13F',
   'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg',
   '1697748', 'fund_manager', NULL, TRUE),
  (12, 'Bill Ackman', 'Pershing Square · 13F',
   'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg',
   '1336528', 'fund_manager', NULL, TRUE)
ON CONFLICT (person_id, kind) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  image_url = COALESCE(EXCLUDED.image_url, dark_pool_featured_profiles.image_url),
  ticker = EXCLUDED.ticker,
  is_active = TRUE;

-- Fund managers were removed with UW cleanup; reseed stubs so snapshot profiles resolve.
INSERT INTO public.dark_pool_fund_managers
  (cik, name, manager_name, image_url, source)
VALUES
  ('1067983', 'Berkshire Hathaway Inc', 'Warren Buffett',
   'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg', 'secapi'),
  ('1697748', 'ARK Investment Management LLC', 'Cathie Wood',
   'https://upload.wikimedia.org/wikipedia/commons/4/44/Cathie_Wood_ARK_Invest_Photo.jpg', 'secapi'),
  ('1336528', 'Pershing Square Capital Management LP', 'Bill Ackman',
   'https://upload.wikimedia.org/wikipedia/commons/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg', 'secapi')
ON CONFLICT (cik) DO UPDATE SET
  name = EXCLUDED.name,
  manager_name = EXCLUDED.manager_name,
  image_url = COALESCE(EXCLUDED.image_url, dark_pool_fund_managers.image_url),
  source = CASE
    WHEN dark_pool_fund_managers.source = 'unusualwhales' THEN 'secapi'
    ELSE dark_pool_fund_managers.source
  END;
