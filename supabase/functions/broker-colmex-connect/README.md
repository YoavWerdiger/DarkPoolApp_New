# Broker Integration – Colmex Pro (TraderEvolution Client API)

אינטגרציה של חשבונות trading מ-Colmex Pro (TraderEvolution) לתיקי ההשקעות באפליקציה. הסנכרון רץ דרך Edge Functions ב-Supabase, מאחסן את ה-credentials מוצפנים ב-`vault.secrets` ומסנכרן executions/positions/orders/state/statements אל הסכמה של `portfolios`.

## ארכיטקטורה

```
[App] ──user JWT──▶ broker-colmex-connect ──▶ TraderEvolution /authorize
                          │                         │
                          ▼                         ▼
                  vault.secrets             broker_connections
                  (user/pass + tokens)      broker_accounts
                                            broker_instrument_map
                                            broker_panel_config

[App] ──user JWT──▶ broker-link-account ──▶ portfolios + broker_accounts
                          │
                          └──▶ broker-colmex-sync (full)

[pg_cron */15min] ──▶ broker-colmex-sync ──▶ TraderEvolution /accounts,/state,
                                              /positions,/orders,/executions,
                                              /statements
                                              │
                                              ▼
                                       broker_account_state
                                       broker_positions
                                       broker_open_orders
                                       broker_executions
                                       broker_statements
                                              │
                                              └──▶ portfolio_transactions
                                                   (ingest_broker_executions/statements_to_portfolio)
```

## טבלאות עיקריות

ראה `supabase/migrations/027_broker_integration.sql`:

- `broker_connections` – חיבור user-to-broker. ה-credentials מוצפנים ב-`vault.secrets`.
- `broker_accounts` – חשבונות trading של המשתמש (ייתכן יותר מחשבון אחד פר חיבור).
- `broker_account_state` – snapshot שוטף של balance/equity/margin.
- `broker_positions` – פוזיציות פתוחות.
- `broker_open_orders` – פקודות פתוחות (limit/stop/SL/TP).
- `broker_executions` – fills בפועל (המקור ל-`portfolio_transactions` עם type='buy'/'sell').
- `broker_statements` – הפקדות/משיכות/עמלות/דיבידנדים (המקור ל-`portfolio_transactions` עם type='deposit'/'withdrawal'/'fee'/'dividend').
- `broker_instrument_map` – mapping של `tradableInstrumentId` ל-symbol אמיתי.
- `broker_panel_config` – cache לשמות עמודות (TraderEvolution מחזיר arrays בלי כותרות).
- `broker_sync_log` – לוג סנכרון.

## Deploy

### 1. Apply migrations
```bash
supabase db push
# או דרך CLI חדש:
supabase migration up
```

המיגרציות הרלוונטיות:
- `027_broker_integration.sql` – כל הסכמה + RPCs ל-vault.
- `028_broker_cron.sql` – pg_cron schedule (יצריך הגדרת secrets בvault מראש, ראה מטה).

### 2. הגדרת secrets ב-vault (פעם אחת)

ב-Supabase Studio → Settings → Vault → Add Secret, צריך להוסיף:

| Name                          | Value                                  |
|-------------------------------|----------------------------------------|
| `SUPABASE_URL`                | https://<your-project>.supabase.co     |
| `SUPABASE_SERVICE_ROLE_KEY`   | ה-service_role key מהפרויקט (Settings → API) |

אלה משמשים את `invoke_broker_colmex_sync()` ב-cron.

### 3. Deploy Edge Functions

```bash
supabase functions deploy broker-colmex-connect
supabase functions deploy broker-colmex-sync
supabase functions deploy broker-colmex-disconnect
supabase functions deploy broker-link-account
```

ה-Functions שלנו דורשים את הסביבה הסטנדרטית:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

(שמופעים אוטומטית ב-Supabase Edge Runtime).

## API

### POST /functions/v1/broker-colmex-connect

חיבור ראשוני. שולחים credentials של Colmex (DMAPI4 בdemo), מקבלים את רשימת החשבונות.

```json
{
  "username": "DMAPI4",
  "password": "DMAPI4!01",
  "environment": "uat"
}
```

תשובה:
```json
{
  "connectionId": "uuid",
  "environment": "uat",
  "accounts": [
    { "brokerAccountId": "ACC-001", "name": "Demo Account", "type": "demo", "currency": "USD", "status": "ACTIVE" }
  ]
}
```

### POST /functions/v1/broker-link-account

יצירת תיק חדש שמסונכרן עם broker_account ספציפי. לאחר זה ה-cron יסנכרן אוטומטית כל 15 דקות, אבל אפשר לבקש sync מיידי עם `triggerSync: true`.

```json
{
  "brokerAccountId": "broker_accounts.id (UUID)",
  "name": "התיק שלי ב-Colmex",
  "currency": "USD",
  "triggerSync": true
}
```

### POST /functions/v1/broker-colmex-sync

טריגר sync ידני. אם נשלח עם user JWT — יסנכרן את כל החיבורים של המשתמש. אם נשלח עם service_role + `connectionId` — מסנכרן חיבור ספציפי. בלי body — cron-style (כל החיבורים שלא סונכרנו ב-15 דקות האחרונות).

```json
{
  "connectionId": "optional uuid",
  "brokerAccountIds": ["optional"],
  "full": false
}
```

### POST /functions/v1/broker-colmex-disconnect

```json
{
  "connectionId": "uuid",
  "purge": false
}
```

`purge=true` ימחק את ה-broker_accounts וגם את התיקים המקושרים. ברירת מחדל: רק מנתק (התיקים נשארים, נהיים `source='manual'`).

## בדיקה ידנית מול UAT (DMAPI4)

```bash
# 1. login (קבל JWT של user רגיל מהאפ)
USER_JWT="..."
SUPABASE_URL="https://<project>.supabase.co"

# 2. connect
curl -X POST "$SUPABASE_URL/functions/v1/broker-colmex-connect" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"username":"DMAPI4","password":"DMAPI4!01","environment":"uat"}'

# 3. בחירת חשבון לחיבור — קח את brokerAccountId מ-broker_accounts ב-DB,
#    זה ה-uuid של ה-broker_accounts (לא ה-id החיצוני)
BROKER_ACCOUNT_UUID="..."

# 4. link
curl -X POST "$SUPABASE_URL/functions/v1/broker-link-account" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"brokerAccountId\":\"$BROKER_ACCOUNT_UUID\",\"triggerSync\":true}"
```

## דברים שלא נכללו עדיין

- **WebSocket real-time** ל-TraderEvolution Quote node. ה-polling כל 15 דקות מספק dataset שלם. בעתיד נוכל להוסיף WS וניסוי לטעון quotes/executions live (ראה Phase 4 בתכנון).
- **OAuth2 flow** (במקום `/authorize` הפשוט). דורש client_id + client_secret מ-Colmex. כשנקבל נוסיף flow נפרד עם redirect.
- **Pending withdrawals UI** – ה-endpoint נקרא ב-sync אבל עדיין לא משוקף ב-UI של התיק (יבוא ב-PR3).
- **Multi-broker** – הקוד מכין לכך ע"י עמודת `broker` בכל הטבלאות, אבל בפועל יש רק `colmex_pro`. הוספת broker חדש דורשת shared module חדש + edge function חדש (לא שינוי בסכמה).
