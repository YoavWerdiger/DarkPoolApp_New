-- ============================================================
-- 023: Seed mock DarkPool data for development/demo
-- Inserts realistic-looking dark pool trades, signals, aggregates
-- and insider buys so the UI has data to display.
-- ============================================================

-- Seed provider state so sync-darkpool knows where to resume
INSERT INTO public.dark_pool_provider_state (provider, last_ts, meta)
VALUES ('mock', NOW() - INTERVAL '1 hour', '{"seeded":true}'::jsonb)
ON CONFLICT (provider) DO UPDATE SET last_ts = NOW() - INTERVAL '1 hour';

-- ── Dark Pool Trades (raw prints) ─────────────────────────────────
INSERT INTO public.dark_pool_trades
  (external_id, ticker, company_name, ts, price, size, premium, side, exchange, market_cap, provider)
VALUES
  ('mock-001', 'AAPL', 'Apple Inc.', NOW() - INTERVAL '2 hours', 189.45, 50000, 9472500, 'buy', 'TRF', 3100000000000, 'mock'),
  ('mock-002', 'AAPL', 'Apple Inc.', NOW() - INTERVAL '90 minutes', 189.50, 30000, 5685000, 'buy', 'TRF', 3100000000000, 'mock'),
  ('mock-003', 'NVDA', 'NVIDIA Corp.', NOW() - INTERVAL '3 hours', 875.20, 15000, 13128000, 'buy', 'TRF', 2150000000000, 'mock'),
  ('mock-004', 'NVDA', 'NVIDIA Corp.', NOW() - INTERVAL '2.5 hours', 876.00, 8000, 7008000, 'buy', 'TRF', 2150000000000, 'mock'),
  ('mock-005', 'TSLA', 'Tesla Inc.', NOW() - INTERVAL '4 hours', 245.80, 20000, 4916000, 'sell', 'TRF', 780000000000, 'mock'),
  ('mock-006', 'MSFT', 'Microsoft Corp.', NOW() - INTERVAL '5 hours', 415.30, 25000, 10382500, 'buy', 'TRF', 3090000000000, 'mock'),
  ('mock-007', 'SPY', 'SPDR S&P 500 ETF', NOW() - INTERVAL '1 hour', 512.40, 100000, 51240000, 'buy', 'TRF', NULL, 'mock'),
  ('mock-008', 'META', 'Meta Platforms', NOW() - INTERVAL '3.5 hours', 492.10, 12000, 5905200, 'buy', 'TRF', 1250000000000, 'mock'),
  ('mock-009', 'AMZN', 'Amazon.com', NOW() - INTERVAL '6 hours', 186.70, 18000, 3360600, 'buy', 'TRF', 1960000000000, 'mock'),
  ('mock-010', 'GOOGL', 'Alphabet Inc.', NOW() - INTERVAL '7 hours', 168.90, 22000, 3715800, 'buy', 'TRF', 2090000000000, 'mock'),
  ('mock-011', 'QQQ', 'Invesco QQQ Trust', NOW() - INTERVAL '2 hours', 442.50, 80000, 35400000, 'buy', 'TRF', NULL, 'mock'),
  ('mock-012', 'NVDA', 'NVIDIA Corp.', NOW() - INTERVAL '1.5 hours', 877.30, 5000, 4386500, 'buy', 'TRF', 2150000000000, 'mock'),
  ('mock-013', 'AAPL', 'Apple Inc.', NOW() - INTERVAL '30 minutes', 190.10, 40000, 7604000, 'buy', 'TRF', 3100000000000, 'mock')
ON CONFLICT DO NOTHING;

-- ── Daily Aggregates (30 days) ────────────────────────────────────
INSERT INTO public.dark_pool_daily_aggregates
  (ticker, date, prints, total_volume, total_premium, buy_premium, sell_premium, whale_count, avg30_premium)
VALUES
  ('AAPL', CURRENT_DATE,     45, 1200000, 22680000, 18144000, 4536000, 2, 18500000),
  ('AAPL', CURRENT_DATE - 1, 38, 980000,  18522000, 14817600, 3704400, 1, 18200000),
  ('AAPL', CURRENT_DATE - 2, 52, 1450000, 27405000, 21924000, 5481000, 3, 18000000),
  ('NVDA', CURRENT_DATE,     62, 880000,  24522000, 22069800, 2452200, 3, 20000000),
  ('NVDA', CURRENT_DATE - 1, 55, 750000,  20925000, 18832500, 2092500, 2, 19500000),
  ('NVDA', CURRENT_DATE - 2, 48, 650000,  18252000, 16426800, 1825200, 2, 19000000),
  ('TSLA', CURRENT_DATE,     35, 600000,  9516000, 4758000, 4758000, 1, 8000000),
  ('TSLA', CURRENT_DATE - 1, 28, 480000,  7617600, 4570560, 3047040, 0, 7800000),
  ('MSFT', CURRENT_DATE,     42, 950000,  10382500, 9344250, 1038250, 1, 9000000),
  ('MSFT', CURRENT_DATE - 1, 38, 820000,  8938400, 8044560, 893840, 1, 8800000),
  ('SPY',  CURRENT_DATE,     120, 5000000, 51240000, 41000000, 10240000, 5, 45000000),
  ('META', CURRENT_DATE,     30, 400000,  5905200,  5314680, 590520, 1, 5000000),
  ('AMZN', CURRENT_DATE,     25, 350000,  3360600,  3024540, 336060, 0, 3000000),
  ('GOOGL', CURRENT_DATE,    28, 380000,  3715800,  3344220, 371580, 0, 3200000),
  ('QQQ',  CURRENT_DATE,     90, 3000000, 35400000, 28320000, 7080000, 4, 30000000)
ON CONFLICT (ticker, date) DO UPDATE SET
  prints = EXCLUDED.prints,
  total_premium = EXCLUDED.total_premium,
  buy_premium = EXCLUDED.buy_premium,
  sell_premium = EXCLUDED.sell_premium,
  whale_count = EXCLUDED.whale_count;

-- ── Signals ───────────────────────────────────────────────────────
INSERT INTO public.dark_pool_signals
  (ticker, signal_type, score, reason, ai_summary, metrics, detected_at, expires_at, bucket_5m)
VALUES
  ('NVDA', 'WHALE', 87,
   'הדפסת ענק: $24.5M ב-3 prints תוך 90 דקות',
   'NVIDIA רושמת פעילות dark pool חריגה — $24.5M בפרמיום ב-3 הדפסות ב-90 דקות. נפח DP עולה על ממוצע 30-יום ב-380%. סיגנל בולט.',
   '{"premium_total":24522000,"prints":3,"side_ratio":0.9,"rel_volume":3.8}'::jsonb,
   NOW() - INTERVAL '1 hour', NOW() + INTERVAL '23 hours',
   to_timestamp(floor(extract(epoch from NOW() - INTERVAL '1 hour') / 300) * 300)),

  ('AAPL', 'HIDDEN_ACCUMULATION', 74,
   'צבירה מוסתרת: buy-flow עולה על sell-flow ב-3 ימים',
   'Apple מציגה דפוס צבירה עקבי בDark Pool — buy premium עולה 80% מהכולל. 3 ימים רצופים של לחץ קניות חיובי. Signal מתחזק.',
   '{"premium_total":22680000,"prints":45,"side_ratio":0.8,"buy_3d":54885600,"sell_3d":13721400}'::jsonb,
   NOW() - INTERVAL '2 hours', NOW() + INTERVAL '22 hours',
   to_timestamp(floor(extract(epoch from NOW() - INTERVAL '2 hours') / 300) * 300)),

  ('SPY', 'UNUSUAL_VOLUME', 92,
   'נפח DP חריג ב-SPY: 10x מהממוצע',
   'S&P 500 ETF רושם נפח Dark Pool חריג ביותר — $51.2M בפרמיום, 10 פעמים מעל ממוצע 30-יום. מצביע על פעילות מוסדית משמעותית.',
   '{"premium_total":51240000,"prints":120,"side_ratio":0.8,"rel_volume":10.1}'::jsonb,
   NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '23.5 hours',
   to_timestamp(floor(extract(epoch from NOW() - INTERVAL '30 minutes') / 300) * 300)),

  ('MSFT', 'SWEEP', 71,
   'Sweep: 4 prints ב-5 דקות, $10.4M',
   'Microsoft — sweep מהיר: 4 הדפסות ב-5 דקות עם פרמיום $10.4M. דפוס אגרסיבי המצביע על execution מוסדי.',
   '{"premium_total":10382500,"prints":4,"time_window_min":5,"side_ratio":0.9}'::jsonb,
   NOW() - INTERVAL '3 hours', NOW() + INTERVAL '21 hours',
   to_timestamp(floor(extract(epoch from NOW() - INTERVAL '3 hours') / 300) * 300))
ON CONFLICT DO NOTHING;

-- ── Insider Buys (Form4) ──────────────────────────────────────────
INSERT INTO public.dark_pool_insider_buys
  (external_id, ticker, insider_name, insider_role, transaction_type, shares, price, value, filed_at, transaction_date, source)
VALUES
  ('form4-001', 'NVDA', 'Jensen Huang', 'CEO', 'P', 10000, 850.00, 8500000, NOW() - INTERVAL '5 days', CURRENT_DATE - 6, 'form4'),
  ('form4-002', 'AAPL', 'Tim Cook', 'CEO', 'P', 50000, 185.50, 9275000, NOW() - INTERVAL '12 days', CURRENT_DATE - 13, 'form4'),
  ('form4-003', 'MSFT', 'Satya Nadella', 'CEO', 'P', 15000, 410.00, 6150000, NOW() - INTERVAL '8 days', CURRENT_DATE - 9, 'form4'),
  ('form4-004', 'META', 'Mark Zuckerberg', 'CEO', 'P', 20000, 480.00, 9600000, NOW() - INTERVAL '3 days', CURRENT_DATE - 4, 'form4'),
  ('form4-005', 'AMZN', 'Andy Jassy', 'CEO', 'P', 30000, 182.00, 5460000, NOW() - INTERVAL '15 days', CURRENT_DATE - 16, 'form4'),
  ('form4-006', 'TSLA', 'Elon Musk', 'CEO', 'P', 100000, 240.00, 24000000, NOW() - INTERVAL '20 days', CURRENT_DATE - 21, 'form4')
ON CONFLICT DO NOTHING;

-- ── Update signals bucket_5m trigger ────────────────────────────
-- Ensure the trigger correctly sets bucket_5m for existing signals
UPDATE public.dark_pool_signals
SET bucket_5m = to_timestamp(floor(extract(epoch from detected_at) / 300) * 300)
WHERE bucket_5m IS NULL;
