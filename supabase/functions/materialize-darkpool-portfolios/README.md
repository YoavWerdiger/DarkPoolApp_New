# materialize-darkpool-portfolios

Precompute Dark Pool portfolio charts + holdings entry/return into
`dark_pool_person_portfolio_snapshots`. Yahoo once per unique ticker → `market_daily_prices`.

## Modes

| Body | Behavior |
|------|----------|
| `{"mode":"hot"}` | curated + featured + followed + recent feed (~60) |
| `{"mode":"full"}` | hot + more funds (~200) |
| `{"ids":[{"id":"P000197","kind":"politician"}]}` | explicit list |

## Cron

- Hot: `15 14-21 * * 1-5` (UTC, US market hours)
- Full: `30 2 * * *`

## Manual curated bootstrap

```bash
curl -X POST "$SUPABASE_URL/functions/v1/materialize-darkpool-portfolios" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}'
```
