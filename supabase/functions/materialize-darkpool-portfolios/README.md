# materialize-darkpool-portfolios

Precompute Dark Pool portfolio charts + holdings entry/return into
`dark_pool_person_portfolio_snapshots`. Yahoo once per unique ticker → `market_daily_prices`.

## Modes

| Body | Behavior |
|------|----------|
| `{"mode":"hot"}` | curated מאוצרים — עד `MATERIALIZE_HOT_MAX_TARGETS` (ברירת מחדל 8) |
| `{"mode":"hot","target_offset":8}` | המשך הרשימה (batch B) |
| `{"mode":"full"}` | כל יעדי materialize (יומי — זהיר עם Yahoo) |
| `{"ids":[{"id":"P000197","kind":"politician"}]}` | explicit list |

## Cron

- Hot batch A (`target_offset=0`): `15 14-21 * * 1-5` (UTC)
- Hot batch B (`target_offset=8`): `45 14-21 * * 1-5` (UTC)
- Full: `30 2 * * *` (`mode=full`, offset 0)

## Manual curated bootstrap

```bash
curl -X POST "$SUPABASE_URL/functions/v1/materialize-darkpool-portfolios" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'
```
