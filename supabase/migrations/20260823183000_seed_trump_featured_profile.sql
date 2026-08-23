-- Donald Trump — פרופיל מאוצר (executive / UW UUID, לא BioGuide קונגרס)
INSERT INTO public.dark_pool_featured_profiles
  (sort_order, name, subtitle, image_url, person_id, kind, ticker, is_active)
VALUES
  (
    0,
    'Donald Trump',
    'נשיא · רפובליקני',
    'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg',
    '888dc73f-f1eb-485a-a241-80657aaaaff9',
    'politician',
    NULL,
    TRUE
  )
ON CONFLICT (person_id, kind) DO UPDATE SET
  name = EXCLUDED.name,
  subtitle = EXCLUDED.subtitle,
  image_url = COALESCE(EXCLUDED.image_url, dark_pool_featured_profiles.image_url),
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;
