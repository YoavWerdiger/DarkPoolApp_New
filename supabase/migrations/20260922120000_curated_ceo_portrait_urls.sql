-- עדכון תמונות מנכ"לים מאוצרים (Wikimedia URLs פעילים)
INSERT INTO public.dark_pool_person_portraits (
  person_id,
  kind,
  display_name,
  ticker,
  image_url,
  source,
  lookup_name,
  fail_count,
  last_error,
  resolved_at
)
VALUES
  ('NVDA:Jensen Huang', 'insider', 'Jensen Huang', 'NVDA', 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Jensen_Huang_%28cropped%29.jpg', 'known', 'Jensen Huang', 0, NULL, now()),
  ('AAPL:Tim Cook', 'insider', 'Tim Cook', 'AAPL', 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg', 'known', 'Tim Cook', 0, NULL, now()),
  ('META:Mark Zuckerberg', 'insider', 'Mark Zuckerberg', 'META', 'https://upload.wikimedia.org/wikipedia/commons/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg', 'known', 'Mark Zuckerberg', 0, NULL, now()),
  ('MSFT:Satya Nadella', 'insider', 'Satya Nadella', 'MSFT', 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Satya_Nadella_%28cropped%29.jpg', 'known', 'Satya Nadella', 0, NULL, now()),
  ('GOOGL:Sundar Pichai', 'insider', 'Sundar Pichai', 'GOOGL', 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Sundar_Pichai_-_2023_%28cropped%29.jpg', 'known', 'Sundar Pichai', 0, NULL, now()),
  ('TSLA:Elon Musk', 'insider', 'Elon Musk', 'TSLA', 'https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg', 'known', 'Elon Musk', 0, NULL, now()),
  ('JPM:Jamie Dimon', 'insider', 'Jamie Dimon', 'JPM', 'https://upload.wikimedia.org/wikipedia/commons/0/00/Chancellor_Rachel_Reeves_meets_Jamie_Dimon_%2854838700663%29_%28cropped%29_%28cropped%29.jpg', 'known', 'Jamie Dimon', 0, NULL, now()),
  ('AMD:Lisa Su', 'insider', 'Lisa Su', 'AMD', 'https://upload.wikimedia.org/wikipedia/commons/d/de/SXSW-2024-alih-OB7A0861-Lisa_Su_%28cropped_2%29.jpg', 'known', 'Lisa Su', 0, NULL, now()),
  ('AMZN:Andy Jassy', 'insider', 'Andy Jassy', 'AMZN', 'https://upload.wikimedia.org/wikipedia/commons/0/07/Andy_Jassy.jpg', 'known', 'Andy Jassy', 0, NULL, now()),
  ('PLTR:Alex Karp', 'insider', 'Alex Karp', 'PLTR', 'https://upload.wikimedia.org/wikipedia/commons/5/50/Alex_Karp_attends_AI_Summit_%2853302457013%29_4-5_ratio.jpg', 'known', 'Alex Karp', 0, NULL, now())
ON CONFLICT (person_id) DO UPDATE SET
  image_url = EXCLUDED.image_url,
  source = EXCLUDED.source,
  fail_count = 0,
  last_error = NULL,
  resolved_at = EXCLUDED.resolved_at,
  updated_at = now();
