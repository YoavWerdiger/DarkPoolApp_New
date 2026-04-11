# TradingView Widget Parameters - רשימת פרמטרים זמינים

## פרמטרים בסיסיים

### General (כללי)
- **`symbol`** - הסימבול להצגה (לדוגמה: "AAPL", "NASDAQ:AAPL")
- **`interval`** - מרווח זמן ברירת מחדל:
  - `1`, `5`, `15`, `30`, `60` - דקות
  - `D` - יומי
  - `W` - שבועי
  - `M` - חודשי
- **`timezone`** - אזור זמן (לדוגמה: "Asia/Jerusalem", "Etc/UTC")
- **`locale`** - שפה (לדוגמה: "he", "en", "ar")
- **`theme`** - ערכת נושא: `"light"` או `"dark"`
- **`style`** - סגנון גרף:
  - `"1"` - Candles (נרות)
  - `"2"` - Hollow Candles
  - `"3"` - Bars (מוטות)
  - `"4"` - Line (קו)
  - `"5"` - Area (אזור)
  - `"6"` - Renko
  - `"7"` - Line Break
  - `"8"` - Kagi
  - `"9"` - Point & Figure

### Colors (צבעים)
- **`backgroundColor`** - צבע רקע (hex, לדוגמה: "#0A0A0A")
- **`gridColor`** - צבע רשת (rgba, לדוגמה: "rgba(255, 255, 255, 0.1)")

### UI Controls (בקרות ממשק)
- **`hide_top_toolbar`** - הסתרת סרגל הכלים העליון (`true`/`false`)
- **`hide_side_toolbar`** - הסתרת סרגל הכלים הצדדי (`true`/`false`)
- **`hide_legend`** - הסתרת מקרא (`true`/`false`)
- **`hide_volume`** - הסתרת נפח (`true`/`false`)
- **`allow_symbol_change`** - אפשרות שינוי סימבול (`true`/`false`)
- **`save_image`** - אפשרות שמירת תמונה (`true`/`false`)

### Features (תכונות)
- **`calendar`** - הצגת לוח שנה כלכלי (`true`/`false`)
- **`hotlist`** - הצגת רשימת חמה (`true`/`false`)
- **`details`** - הצגת פרטים (`true`/`false`)
- **`withdateranges`** - הצגת טווחי תאריכים (`true`/`false`)
- **`autosize`** - התאמה אוטומטית לגודל (`true`/`false`)

### Advanced (מתקדם)
- **`studies`** - רשימת אינדיקטורים (array, לדוגמה: `["RSI@tv-basicstudies", "MACD@tv-basicstudies"]`)
- **`compareSymbols`** - רשימת סימבולים להשוואה (array)
- **`watchlist`** - רשימת מעקב (array)

## אינדיקטורים זמינים (Studies)

### Basic Studies
- `RSI@tv-basicstudies` - RSI
- `MACD@tv-basicstudies` - MACD
- `Stochastic@tv-basicstudies` - Stochastic
- `ADX@tv-basicstudies` - ADX
- `CCI@tv-basicstudies` - CCI
- `ATR@tv-basicstudies` - ATR
- `Williams%R@tv-basicstudies` - Williams %R
- `BB@tv-basicstudies` - Bollinger Bands
- `Volume@tv-basicstudies` - Volume

### Moving Averages
- `MASimple@tv-basicstudies` - Simple Moving Average
- `EMA@tv-basicstudies` - Exponential Moving Average
- `MASmoothed@tv-basicstudies` - Smoothed Moving Average
- `MALinear@tv-basicstudies` - Linear Weighted Moving Average

## דוגמה לשימוש מלא

```javascript
{
  "autosize": true,
  "symbol": "AAPL",
  "interval": "5",
  "timezone": "Asia/Jerusalem",
  "theme": "dark",
  "style": "1",
  "locale": "he",
  "backgroundColor": "#0A0A0A",
  "gridColor": "rgba(255, 255, 255, 0.1)",
  "hide_top_toolbar": true,
  "hide_legend": true,
  "hide_side_toolbar": true,
  "save_image": false,
  "calendar": false,
  "hotlist": false,
  "hide_volume": false,
  "studies": ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
  "withdateranges": false,
  "allow_symbol_change": false,
  "details": false
}
```

## הערות חשובות

1. **Markers/Annotations** - TradingView Widget לא תומך ישירות בסימון תאריכים ספציפיים דרך URL parameters. כדי להוסיף markers מותאמים אישית, צריך להשתמש ב:
   - **TradingView Charting Library** (הגרסה המלאה) - תומך ב-markers מלאים
   - **Lightweight Charts** - תומך ב-markers דרך JavaScript API
   - **TradingView Widget** - מציג אירועי earnings אוטומטית אם הם זמינים, אבל לא ניתן לשלוט במיקום או סגנון

2. **Earnings Events** - TradingView מציג אירועי earnings אוטומטית אם הם זמינים עבור הסימבול (מסומן ב-"E" בתחתית הגרף), אבל לא ניתן לשלוט בזה דרך פרמטרים.

3. **Custom Markers** - כדי להוסיף markers מותאמים אישית (כמו "מסחר מוקדם" / "מסחר מאוחר"), צריך להשתמש ב-TradingView Charting Library או Lightweight Charts עם JavaScript.

4. **אלטרנטיבה** - ניתן להציג את המידע על before/after market כטקסט מעל או מתחת לגרף במקום marker בגרף עצמו.

## קישורים שימושיים

- [TradingView Widget Documentation](https://www.tradingview.com/widget-docs/)
- [Advanced Chart Widget](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/)
- [TradingView Charting Library](https://www.tradingview.com/charting-library-docs/)





