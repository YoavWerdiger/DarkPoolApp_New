# ביקורת Realtime לפרודקשן — DarkPool App

תאריך: 2026-05-25  
מטרה: מפת מצב של כל שימושי Supabase Realtime (`postgres_changes`) מול מה שמוגדר ב-DB, ופערים לפרודקשן.

---

## סיכום מנהלים

| מצב | משמעות |
|-----|--------|
| **צ'אט** | הליבה הכי מפותחת: מנוי קבוצה + מנוי גלובלי, retry, reconnect ב-foreground, מיגרציות 023/047/048. אחרי תיקון אחרון — גיבוי הודעות ל-thread פעיל דרך המנוי הגלובלי. |
| **ברוקר / תיק Colmex** | Publication ב-027; הקליינט מאזין ב-`useBrokerPortfolio`. **אין** באנר חיבור / retry מרכזי. |
| **Dark Pool** | הקליינט מאזין ל-`dark_pool_signals` / `dark_pool_trades` — **אין** הוספה ל-`supabase_realtime` במיגרציות הרשמיות → בפרודקשן Realtime כנראה **לא עובד**. |
| **חדשות / דוחות / לוח שנה** | יש מנוי בקוד; Publication רק בקבצי SQL ישנים בשורש הפרויקט — **לא** ב-`supabase/migrations` (חוץ מ-051 החדש). |
| **תיק ידני (Portfolios)** | מחירים דרך **Finnhub WebSocket** (`realtimeQuotes`) — לא Supabase. |
| **UW / Edge cache** | רענון ב-polling / fetch — לא `postgres_changes`. |

**מסקנה:** Realtime **לא תקין בכל המערכת**. הצ'אט קרוב לפרודקשן אם הורצו 047+048 (+ התיקונים בקוד). שאר הפיצ'רים תלויים בהרצת מיגרציית publication או יישארו תלויים ב-pull/refetch.

---

## צ'קליסט פרודקשן (Supabase SQL Editor)

```sql
-- 1) טבלאות ב-publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2) מדיניות realtime.messages (נדרש אם "Allow public access" כבוי)
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'realtime' AND tablename = 'messages';

-- 3) REPLICA IDENTITY ל-chat_group_members (DELETE עם group_id)
SELECT c.relname, c.relreplident
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'chat_group_members';
-- צפוי: relreplident = 'f' (FULL)
```

הרץ גם: `supabase/migrations/047_chat_realtime_publication.sql`, `048_realtime_messages_authenticated.sql`, `051_realtime_publications_production.sql`.

---

## מפת פיצ'רים

### 1. צ'אט (קריטי) — **טוב יחסית**

| רכיב | קובץ | טבלאות Realtime |
|------|------|-----------------|
| מנוי קבוצה פעילה | `services/chat/chatRealtimeService.ts` | `chat_messages`, `chat_message_reactions`, `chat_message_reads`, `chat_typing_indicators`, `chat_group_members`, `chat_groups` |
| מנוי כל הקבוצות | אותו קובץ | `chat_messages` INSERT, `chat_group_members` * |
| State + UI | `context/ChatContext.tsx` | — |
| באנר חיבור | `ChatGroupScreen`, `ChatGroupsListScreen` | `realtimeConnectionState` |

**מיגרציות:** `023`, `047`, `048`  
**טריגרים:** `database/chat_realtime_and_triggers.sql` (unread על INSERT)

**חוזקות:**
- ערוצים נפרדים (מניעת binding mismatch)
- Retry עם exponential backoff
- `resubscribeActiveGroupRef` אחרי foreground
- `ingestIncomingInsert` + גיבוי מ-`subscribeToAllUserGroups` ל-thread פתוח
- `enrichChatMessageSender` להודעות בלי join

**סיכונים / פערים:**
| # | חומרה | נושא |
|---|--------|------|
| C1 | בינוני | `subscribeToGroup` מחזיר מוקדם אם הערוצים כבר קיימים — לא מעדכן listeners (מסתמך על ref ל-ingest) |
| C2 | בינוני | `processedMessageIds.clear()` בכל `selectGroup` — על refocus עלול לגרום כפילויות נדירות |
| C3 | נמוך | `subscribeToUserStatus` על `users` — **לא** ב-publication 047; **לא בשימוש** בקוד |
| C4 | נמוך | `services/typingService.ts` (Presence) — **קוד מת**; צ'אט משתמש ב-`chat_typing_indicators` |
| C5 | מידע | מערכת ישנה `messages` / `channels` בקבצי SQL בשורש — **לא** בשימוש ב-ChatNew |

---

### 2. רשימת צ'אטים (באדג' / preview) — **תלוי בצ'אט**

- מתעדכן מ-`subscribeToAllUserGroups` → `setGroups` (last_message, unread מ-UPDATE על `chat_group_members`)
- אין `useFocusEffect` refetch (M8) — נכון אם Realtime חי

---

### 3. חדשות מתפרצות — **פרודקשן בסיכון**

| קובץ | טבלה | Publication במיגרציות |
|------|------|------------------------|
| `screens/News/BreakingNewsTab.tsx` | `app_news_clean` | רק בקבצים ישנים / 051 |
| `services/newsService.ts` | `app_news_clean` | כנ"ל — API כפול, לא בשימוש במסך? |

**קוד:** INSERT בלבד; `CHANNEL_ERROR` → `console.warn` בלבד, **בלי reconnect**.

---

### 4. דוחות רווחים (Earnings) — **פרודקשן בסיכון**

| קובץ | טבלה |
|------|------|
| `screens/News/EarningsReportsTab.tsx` | `earnings_calendar` |

**קוד:** patch מקומי ב-state (טוב); Publication מ-`create_financial_calendar_tables.sql` (לא migration רשמי) / 051.

---

### 5. לוח שנה כלכלי — **פרודקשן בסיכון**

| קובץ | טבלה |
|------|------|
| `screens/News/EconomicCalendarTab.tsx` | `economic_events` |

**קוד:** על כל אירוע → `loadEconomicEvents()` מלא (עובד אבל כבד). Publication: `create_economic_events_table.sql` / 051.

---

### 6. Dark Pool — **Realtime כנראה שבור בפרודקשן**

| קובץ | טבלאות |
|------|--------|
| `services/darkpool/darkPoolService.ts` → `subscribeDarkPool` | `dark_pool_signals`, `dark_pool_trades` |
| `hooks/useDarkPoolFeed.ts` | רק Premium; רק signals |

**Publication:** `018_dark_pool.sql` — **אין** `ALTER PUBLICATION`.  
**התנהגות:** `CHANNEL_ERROR` → log בלבד; משתמש רואה נתונים מ-fetch בלבד עד רענון.

**שאר Dark Pool (Explore, Congress, UW):** Edge Functions + DB cache — **polling**, לא Realtime.

---

### 7. ברוקר / תיק מחובר — **DB מוכן, קליינט בסיסי**

| קובץ | טבלאות |
|------|--------|
| `hooks/useBrokerPortfolio.ts` | `broker_account_state`, `broker_positions`, `broker_open_orders` |

**Publication:** `027_broker_integration.sql`  
**חסר:** retry, status banner, `CHANNEL_ERROR` handling.

---

### 8. תיקים ידניים (Portfolios) — **לא Supabase Realtime**

| קובץ | מקור |
|------|------|
| `services/portfolios/realtimeQuotes.ts` | Finnhub WebSocket |
| `screens/Portfolios/hooks/useRealtimeHoldings.ts` | מחירים חיים |

שינויי `portfolio_transactions` / snapshots — **אין** מנוי; עדכון ב-navigate / pull.

---

### 9. שווקים / Fear&Greed / למידה

אין `postgres_changes` בקוד React הנוכחי — רענון ב-focus / interval / manual.

---

## מיגרציות Supabase (סדר מומלץ)

| # | קובץ | תפקיד |
|---|------|--------|
| 023 | `chat_group_members` REPLICA IDENTITY FULL | DELETE membership |
| 047 | chat tables → publication | צ'אט |
| 048 | policy על `realtime.messages` | חיבור authenticated |
| 051 | news + dark pool + calendar → publication | שאר הפיצ'רים |

**שים לב:** קיימים שני קבצים `047_*` — ודא ש-`047_chat_realtime_publication.sql` הורץ בפרודקשן.

---

## בדיקות ידניות מומלצות

### צ'אט
1. שני מכשירים באותה קבוצה — הודעה מ-A מופיעה אצל B **בלי** לצאת.
2. שליחה מ-A — בועה אופטימיסטית מיד; מזהה שרת אחרי תגובת API.
3. רקע → חזרה — באנר "מתחבר" (אם יש) ואז הודעות ממשיכות.
4. יציאה מקבוצה (admin) — קבוצה נעלמת מהרשימה.

### חדשות
5. INSERT ל-`app_news_clean` — מופיע ב-Breaking News בלי רענון.

### Dark Pool (Premium)
6. INSERT ל-`dark_pool_signals` — מופיע ב-feed Live.

### ברוקר
7. שינוי `broker_positions` אחרי sync — UI מתעדכן.

---

## עדיפויות תיקון

| עדיפות | פעולה |
|--------|--------|
| P0 | הרץ 047, 048, 051 בפרודקשן + אימות `pg_publication_tables` |
| P0 | ודא deploy אחרון של `ChatContext` (גיבוי ingest) |
| P1 | Dark Pool: אחרי 051 — בדיקת Premium live feed |
| P1 | News: reconnect / refetch on `CHANNEL_ERROR` |
| P2 | מרכז `RealtimeHealth` משותף (סטטוס + reconnect) לכל המסכים |
| P2 | הסר / ארכב `typingService.ts` ומערכת `messages` הישנה |
| P3 | Publication ל-`users` רק אם מפעילים online indicators |

---

## קבצי עזר בפרויקט

- `check_realtime_status.sql` — בדיקת publication
- `database/chat_realtime_and_triggers.sql` — טריגר unread + publication
- `CHAT_LIST_REALTIME_FIX.md` — תיעוד ישן (מערכת channels ישנה)
