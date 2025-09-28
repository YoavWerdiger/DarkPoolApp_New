-- יצירת טבלה לאירועים כלכליים אמיתיים עם תאריכים נכונים
-- Real Economic Events Table with Correct Dates

-- טבלת economic_events_real לאירועים כלכליים אמיתיים
CREATE TABLE IF NOT EXISTS economic_events_real (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  importance TEXT CHECK (importance IN ('high', 'medium', 'low')) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  description TEXT,
  category TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_economic_events_real_date ON economic_events_real(event_date);
CREATE INDEX IF NOT EXISTS idx_economic_events_real_importance ON economic_events_real(importance);
CREATE INDEX IF NOT EXISTS idx_economic_events_real_country ON economic_events_real(country);
CREATE INDEX IF NOT EXISTS idx_economic_events_real_category ON economic_events_real(category);

-- RLS (Row Level Security) policies
ALTER TABLE economic_events_real ENABLE ROW LEVEL SECURITY;

-- כולם יכולים לקרוא אירועים כלכליים
CREATE POLICY "Anyone can view economic events" ON economic_events_real
  FOR SELECT USING (true);

-- רק אדמינים יכולים לעדכן (אם נוסיף בעתיד)
CREATE POLICY "Only admins can modify economic events" ON economic_events_real
  FOR ALL USING (false); -- נשנה בעתיד אם נצטרך

-- הוספת נתוני דמו אמיתיים עם תאריכים נכונים
INSERT INTO economic_events_real (
  id, title, country, currency, importance, event_date, event_time,
  actual, forecast, previous, description, category, source
) VALUES 
-- אירועים שכבר קרו (עם תאריכים אמיתיים)
(
  'fed_rate_sep_17_2024',
  'החלטת ריבית פדרל ריזרב (FOMC)',
  'ארצות הברית',
  'USD',
  'high',
  '2024-09-17',
  '21:00',
  '4.75-5.00%',
  '5.00-5.25%',
  '5.25-5.50%',
  'הפד הוריד ריבית ב-0.5% - הורדה ראשונה מאז 2020. צעד דרמטי שמעיד על דאגה מהאטה כלכלית.',
  'מדיניות מוניטרית',
  'Federal Reserve'
),
(
  'cpi_sep_11_2024',
  'מדד המחירים לצרכן (CPI) - אוגוסט',
  'ארצות הברית',
  'USD',
  'high',
  '2024-09-11',
  '15:30',
  '2.5%',
  '2.6%',
  '2.9%',
  'מדד האינפלציה המרכזי ירד מתחת ליעד הפד של 2%. נתון חיובי המחזק את הצפיות להורדת ריבית.',
  'אינפלציה',
  'Bureau of Labor Statistics'
),
(
  'nonfarm_payrolls_sep_06_2024',
  'דו"ח תעסוקה (Non-Farm Payrolls) - אוגוסט',
  'ארצות הברית',
  'USD',
  'high',
  '2024-09-06',
  '15:30',
  '142K',
  '165K',
  '114K',
  'תוספת משרות חלשה מהצפוי. שוק העבודה מתקרר, מה שמחזק את הצפיות להורדת ריבית בפד.',
  'תעסוקה',
  'Bureau of Labor Statistics'
),
-- אירועים עתידיים (תאריכים אמיתיים)
(
  'jobless_claims_sep_19_2024',
  'בקשות דמי אבטלה שבועיות',
  'ארצות הברית',
  'USD',
  'medium',
  '2024-09-19',
  '15:30',
  NULL,
  '230K',
  '227K',
  'מספר הבקשות החדשות לדמי אבטלה השבוע. מדד מוקדם לבריאות שוק העבודה.',
  'תעסוקה',
  'Department of Labor'
),
(
  'boe_rate_decision_sep_19_2024',
  'החלטת ריבית בנק אנגליה (BoE)',
  'בריטניה',
  'GBP',
  'high',
  '2024-09-19',
  '14:00',
  NULL,
  '5.00%',
  '5.25%',
  'בנק אנגליה צפוי להוריד ריבית בעקבות הפד. האינפלציה בבריטניה ירדה מתחת ליעד של 2%.',
  'מדיניות מוניטרית',
  'Bank of England'
),
(
  'boj_rate_decision_sep_20_2024',
  'החלטת ריבית בנק יפן (BoJ)',
  'יפן',
  'JPY',
  'high',
  '2024-09-20',
  '04:00',
  NULL,
  '0.25%',
  '0.10%',
  'בנק יפן צפוי להעלות ריבית בהדרגה לאחר עשרות שנים של ריבית אפס.',
  'מדיניות מוניטרית',
  'Bank of Japan'
)
ON CONFLICT (id) DO UPDATE SET
  actual = EXCLUDED.actual,
  updated_at = NOW();

-- הוספת הערות לתיעוד
COMMENT ON TABLE economic_events_real IS 'טבלה לאירועים כלכליים אמיתיים עם תאריכים נכונים';
COMMENT ON COLUMN economic_events_real.event_date IS 'תאריך האירוע (YYYY-MM-DD)';
COMMENT ON COLUMN economic_events_real.event_time IS 'שעת האירוע (HH:MM)';
COMMENT ON COLUMN economic_events_real.actual IS 'נתון ממשי (לאחר פרסום)';
COMMENT ON COLUMN economic_events_real.forecast IS 'תחזית/קונצנזוס';
COMMENT ON COLUMN economic_events_real.previous IS 'נתון קודם';

-- בדיקת יצירת הטבלה
SELECT 'economic_events_real table created successfully with real dates' AS status;
