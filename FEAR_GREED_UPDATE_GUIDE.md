# מדריך עדכון מדד הפחד והתאווה (Fear and Greed Index)

## סקירה כללית

המדד מתעדכן פעם ביום, אבל האפליקציה יכולה לבדוק לעתים קרובות יותר. יש שתי אפשרויות לעדכון:

1. **Edge Function (מומלץ)** - עדכון אוטומטי דרך Supabase
2. **n8n Workflow** - עדכון דרך n8n עם יותר שליטה

## אפשרות 1: Edge Function (מומלץ)

### יתרונות:
- ✅ מובנה ב-Supabase
- ✅ קל לפרוס
- ✅ יכול לרוץ על Cron Job של Supabase
- ✅ אין צורך בשירות חיצוני

### שלבי ההגדרה:

#### 1. יצירת טבלה במסד הנתונים

**קל ומהיר:** הרץ את הקובץ `setup_fear_greed_index.sql` ב-SQL Editor של Supabase:

```bash
# או העתק את התוכן מ-setup_fear_greed_index.sql
```

הקובץ כולל:
- יצירת טבלה `fear_and_greed_index`
- הגדרת RLS Policies
- יצירת Indexים

**או ידנית:**
```sql
-- יצירת טבלה למדד
CREATE TABLE IF NOT EXISTS fear_and_greed_index (
  id INTEGER PRIMARY KEY DEFAULT 1,
  value INTEGER NOT NULL CHECK (value >= 0 AND value <= 100),
  value_classification TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  raw_data JSONB,
  CONSTRAINT single_row CHECK (id = 1)
);

-- יצירת index לעדכונים מהירים
CREATE INDEX IF NOT EXISTS idx_fear_greed_updated_at ON fear_and_greed_index(updated_at);

-- RLS Policy - כל אחד יכול לקרוא
ALTER TABLE fear_and_greed_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fear and greed index"
  ON fear_and_greed_index
  FOR SELECT
  USING (true);

-- רק service role יכול לעדכן
CREATE POLICY "Service role can update fear and greed index"
  ON fear_and_greed_index
  FOR ALL
  USING (auth.role() = 'service_role');
```

#### 2. הגדרת משתנה סביבה

הוסף את מפתח ה-RapidAPI ל-Supabase:

```bash
# דרך Supabase Dashboard:
# Settings > Edge Functions > Environment Variables
# הוסף: RAPIDAPI_KEY = "your-api-key-here"
```

או דרך CLI:
```bash
supabase secrets set RAPIDAPI_KEY=your-api-key-here
```

#### 3. פריסת ה-Edge Function

```bash
# מהתיקייה הראשית של הפרויקט
supabase functions deploy fear-greed-update
```

#### 4. הגדרת Cron Job לעדכון אוטומטי

**קל ומהיר:** הרץ את הקובץ `setup_fear_greed_cron.sql` ב-SQL Editor של Supabase:

```bash
# או העתק את התוכן מ-setup_fear_greed_cron.sql
```

הקובץ כולל:
- יצירת Cron Job שירוץ כל 6 שעות
- עדכון אוטומטי של המדד במסד הנתונים

**או ידנית דרך Supabase Dashboard:**
1. לך ל **Database** > **Cron Jobs**
2. צור Cron Job חדש:
   - **Name**: `fear-greed-index-update`
   - **Schedule**: `0 */6 * * *` (כל 6 שעות: 00:00, 06:00, 12:00, 18:00 UTC)
   - **SQL Command**: 
   ```sql
   SELECT net.http_post(
     url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
     headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
     body := '{}'::jsonb
   );
   ```

**הערה:** המדד מתעדכן פעם ביום ב-API, אבל נבדוק כל 6 שעות כדי להיות מעודכנים.

#### 5. עדכון הקומפוננטה לקריאה מהמסד

עדכן את `components/News/FearAndGreedCard.tsx` לקרוא מהמסד במקום ישירות מה-API:

```typescript
// הוסף import
import { supabase } from '../../services/supabase';

// עדכן את loadFearAndGreedIndex
const loadFearAndGreedIndex = async () => {
  try {
    setLoading(true);
    setError(null);
    
    // נסה לקרוא מהמסד קודם
    const { data: dbData, error: dbError } = await supabase
      .from('fear_and_greed_index')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (!dbError && dbData) {
      // יש נתונים במסד - השתמש בהם
      setData({
        value: dbData.value,
        valueClassification: dbData.value_classification,
        timestamp: dbData.timestamp,
      });
      setLoading(false);
      return;
    }
    
    // אם אין במסד, נסה מה-API ישירות
    const currentValue = await fearAndGreedService.getCurrentValue();
    setData(currentValue);
  } catch (err: any) {
    console.error('❌ FearAndGreedCard: Error loading data:', err);
    setError(err.message || 'שגיאה בטעינת המדד');
  } finally {
    setLoading(false);
  }
};
```

## אפשרות 2: n8n Workflow

### יתרונות:
- ✅ יותר שליטה על הלוגיקה
- ✅ יכול לשלוח התראות
- ✅ יכול לשלב עם שירותים אחרים
- ✅ ממשק גרפי נוח

### שלבי ההגדרה:

#### 1. יצירת Workflow ב-n8n

1. צור Workflow חדש ב-n8n
2. הוסף Node מסוג **HTTP Request**:
   - **Method**: GET
   - **URL**: `https://fear-and-greed-index.p.rapidapi.com/v1/fgi`
   - **Headers**:
     ```
     x-rapidapi-host: fear-and-greed-index.p.rapidapi.com
     x-rapidapi-key: YOUR_API_KEY
     ```

3. הוסף Node מסוג **Code** לעיבוד הנתונים:
   ```javascript
   const data = $input.item.json;
   let value, classification, timestamp;
   
   if (data.fgi?.now) {
     value = data.fgi.now.value || 50;
     classification = data.fgi.now.valueText || data.fgi.now.valueClassification || 'Neutral';
     timestamp = data.fgi.now.timestamp || data.fgi.now.lastUpdated?.epochUnixSeconds || Math.floor(Date.now() / 1000);
   } else {
     value = data.value || 50;
     classification = data.valueClassification || 'Neutral';
     timestamp = data.timestamp || Math.floor(Date.now() / 1000);
   }
   
   return {
     json: {
       id: 1,
       value: Math.max(0, Math.min(100, value)),
       value_classification: classification,
       timestamp: timestamp,
       updated_at: new Date().toISOString(),
       raw_data: data
     }
   };
   ```

4. הוסף Node מסוג **Supabase** לשמירה:
   - **Operation**: Update
   - **Table**: `fear_and_greed_index`
   - **Update Key**: `id`
   - **Data**: השתמש בנתונים מה-Code Node

5. הוסף **Schedule Trigger**:
   - **Cron Expression**: `0 */6 * * *` (כל 6 שעות)

#### 2. הפעלת ה-Workflow

שמור והפעל את ה-Workflow. הוא ירוץ אוטומטית לפי ה-Schedule.

## השוואה בין האפשרויות

| תכונה | Edge Function | n8n Workflow |
|------|---------------|--------------|
| קלות התקנה | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| עלות | חינם (כלול ב-Supabase) | תלוי בתוכנית |
| שליטה | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| תחזוקה | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| אינטגרציה | Supabase בלבד | כל שירות |

## המלצה

**לשימוש פשוט**: השתמש ב-Edge Function עם Cron Job של Supabase.

**לשימוש מתקדם**: השתמש ב-n8n אם אתה צריך:
- לשלוח התראות Push
- לשלב עם שירותים נוספים
- לוגיקה מורכבת יותר

## בדיקה

### בדיקת Edge Function:
```bash
# קריאה ידנית ל-Edge Function
curl -X POST \
  'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ' \
  -H 'Content-Type: application/json'
```

### בדיקת הטבלה:
```sql
-- בדיקת הנתונים במסד
SELECT * FROM fear_and_greed_index;

-- בדיקת Cron Job
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'fear-greed-index-update';
```

### סדר הפעולות המומלץ:
1. ✅ הרץ `setup_fear_greed_index.sql` ליצירת הטבלה
2. ✅ הגדר `RAPIDAPI_KEY` ב-Supabase Secrets
3. ✅ פרוס את ה-Edge Function: `supabase functions deploy fear-greed-update`
4. ✅ הרץ `setup_fear_greed_cron.sql` ליצירת ה-Cron Job
5. ✅ בדוק שהכל עובד עם הקריאה הידנית או בדיקת הטבלה

