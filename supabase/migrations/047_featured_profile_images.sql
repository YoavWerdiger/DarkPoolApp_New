-- תמונות featured + fund managers (Wikimedia / congress)

UPDATE public.dark_pool_featured_profiles SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg'
WHERE name = 'Elon Musk';

UPDATE public.dark_pool_featured_profiles SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/2/23/Tim_Cook_2009_cropped.jpg'
WHERE name = 'Tim Cook';

UPDATE public.dark_pool_featured_profiles SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg'
WHERE person_id = '1067983';

UPDATE public.dark_pool_featured_profiles SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Cathie_Wood_%28cropped%29.jpg'
WHERE person_id = '1697748';

UPDATE public.dark_pool_featured_profiles SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Bill_Ackman_2019.jpg'
WHERE person_id = '1336528';

UPDATE public.dark_pool_fund_managers SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/5/51/Warren_Buffett_KU_Visit.jpg'
WHERE cik = '1067983';

UPDATE public.dark_pool_fund_managers SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Cathie_Wood_%28cropped%29.jpg'
WHERE cik = '1697748';

UPDATE public.dark_pool_fund_managers SET image_url = 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Bill_Ackman_2019.jpg'
WHERE cik = '1336528';
