# sync-quiver-congress-cache

Daily Quiver cache for congress **politicians** + **stock holdings**
(curated BioGuides; optional `top_active` in body).

## Where BioGuide comes from

1. **`CURATED_CONGRESS_BIOGUIDES`** in `_shared/quiverQuant.ts` — hard-coded curated list (Pelosi, Moskowitz, …)
2. **`quiver_congress_politicians`** cache — Quiver `BioGuideID` from `/beta/bulk/congress/politicians`
3. **`dark_pool_congress_trades.politician_id`** — when the id matches `^[A-Z]\\d{6}$`

Then holdings: `GET /beta/live/congress_stock_holdings?bioguide_id=…`
→ fields `CurrentHolding` (USD) + `Allocation` (%) — no share counts invented.

Ticker page: `{"ticker":"NVDA","politicians":false}` →
`GET /beta/live/congress_stock_holdings?ticker=NVDA` merged into `by_bioguide`
and stamped on `tickers_synced.NVDA`.

Person profile: `{"bioguides":["P000197"],"politicians":false}` →
`GET /beta/live/congress_stock_holdings?bioguide_id=P000197` replaces that
person's full list and stamps `bioguides_synced.P000197`. A ticker merge never
stamps a bioguide (one stock ≠ a portfolio).

Payload extras: `top_by_trade_count` (Top 25 by TradeCount) + `curated_bioguides`.
Holdings merge with prior cache so a partial run does not wipe other BioGuides.

## Secrets

```bash
npx supabase secrets set QUIVER_API_KEY=<your-key>   # never paste in chat
npx supabase secrets set CONGRESS_TRADES_PROVIDER=quiverquant
```

## Endpoints used

| Quiver path | Cache key |
|-------------|-----------|
| `GET /beta/bulk/congress/politicians` | `quiver_congress_politicians` |
| `GET /beta/live/congress_stock_holdings?bioguide_id=` | `quiver_congress_holdings` |

Related deep-history (not this function): `GET /beta/bulk/congresstrading?bioguide_id=` in `sync-congress-trades`.

Consumers: `uw-explore`, `uw-investor-profile` (prefer Quiver holdings for curated profiles).

## Deploy

```bash
npx supabase functions deploy sync-quiver-congress-cache sync-congress-trades uw-explore uw-investor-profile --no-verify-jwt
```

## Manual run

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-quiver-congress-cache" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" -d '{}'

# single bioguide refresh
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-quiver-congress-cache" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"bioguides":["P000197"]}'

# ticker holders (DarkPoolTickerScreen)
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/sync-quiver-congress-cache" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"ticker":"NVDA","politicians":false}'
```
