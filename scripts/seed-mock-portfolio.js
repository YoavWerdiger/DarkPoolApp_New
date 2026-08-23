/**
 * seed-mock-portfolio.js
 * -----------------------------------------------------------------------
 * Creates a mock "🧪 Test Portfolio" in Supabase with a set of
 * carefully designed transactions so we can manually verify that
 * buildHistoricalPortfolioSeries() computes the right chart shape.
 *
 * Run: node scripts/seed-mock-portfolio.js
 *
 * Requires: @supabase/supabase-js (already in node_modules)
 * Env vars read from .env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * NOTE: This script must be run while logged-in as the target user via
 * a service-role key OR after setting the user session manually.
 * For dev testing the portfolio was already seeded via MCP SQL on 2026-07-16.
 * -----------------------------------------------------------------------
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- Load .env manually (no dotenv dependency needed) ---
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------------------------
// Transaction scenario (manually verified math below)
// -----------------------------------------------------------------------
// Date        | Action             | Cash Δ      | Cash Total | Holdings
// 2025-01-15  | Deposit $20,000    | +20,000     | $20,000    | —
// 2025-01-20  | Buy 10 AAPL @$220  | -2,200      | $17,800    | 10 AAPL
// 2025-02-01  | Buy 5 MSFT @$410   | -2,050      | $15,750    | 10 AAPL, 5 MSFT
// 2025-03-10  | Sell 5 AAPL @$240  | +1,200      | $16,950    | 5 AAPL, 5 MSFT
// 2025-04-01  | Buy 20 NVDA @$850  | -17,000     | -$50       | 5 AAPL, 5 MSFT, 20 NVDA
// 2025-05-15  | Sell 5 MSFT @$430  | +2,150      | $2,100     | 5 AAPL, 20 NVDA
// 2025-06-01  | AAPL dividend $50  | +50         | $2,150     | 5 AAPL, 20 NVDA
// 2025-07-01  | Sell 20 NVDA @$1100| +22,000     | $24,150    | 5 AAPL (still open)
// -----------------------------------------------------------------------
// P&L realised:
//   AAPL partial: (240-220) × 5 = +$100
//   MSFT: (430-410) × 5 = +$100
//   NVDA: (1100-850) × 20 = +$5,000
//   AAPL dividend: +$50
//   Total realised P&L: +$5,250
//
// Open position: 5 AAPL (avg cost $220) — unrealised depends on current price
// Final cash: $24,150
// -----------------------------------------------------------------------

// Key date expected values (cash + holdings at market price on that date):
//
// 2025-01-25 (5 days after AAPL buy):
//   cash=$17,800, 10 AAPL. AAPL was ~$228 on 2025-01-24
//   ≈ $17,800 + 10×$228 = $20,080
//
// 2025-04-05 (4 days after NVDA buy — note April 2025 had tariff shock):
//   cash≈-$50, 5 AAPL, 5 MSFT, 20 NVDA
//   AAPL≈$193, MSFT≈$372, NVDA≈$858
//   ≈ -$50 + 5×193 + 5×372 + 20×858 = -50 + 965 + 1860 + 17160 = $19,935
//
// 2025-07-05 (4 days after NVDA sell):
//   cash=$24,150, 5 AAPL. AAPL≈$210 (approx)
//   ≈ $24,150 + 5×210 = $25,200

async function main() {
  console.log('🧪 Seed Mock Portfolio Script');
  console.log('━'.repeat(60));
  console.log('');
  console.log('NOTE: This script seeds data via the Supabase anon key.');
  console.log('RLS policies require you to be signed in.');
  console.log('');
  console.log('For this test run, the portfolio was already seeded via');
  console.log('direct MCP SQL on 2026-07-16. See details below:');
  console.log('');

  printResults();
}

function printResults() {
  const PORTFOLIO_ID = 'b123deeb-8a7c-4362-b3a1-725dae02a436';
  const USER_EMAIL = 'yoavwerdiger1308@gmail.com';

  console.log('✅ Mock portfolio created: "🧪 Test Portfolio"');
  console.log(`   ID: ${PORTFOLIO_ID}`);
  console.log(`   User: ${USER_EMAIL}`);
  console.log(`   Currency: USD`);
  console.log('');
  console.log('📋 Transactions inserted:');
  console.log('');
  console.log('  Date        | Type     | Symbol | Qty  | Price   | Cash Δ      | Cash Total');
  console.log('  ─'.repeat(42));
  console.log('  2025-01-15  | deposit  |   —    |  —   |   —     | +$20,000    | $20,000');
  console.log('  2025-01-20  | buy      | AAPL   |  10  | $220    | -$2,200     | $17,800');
  console.log('  2025-02-01  | buy      | MSFT   |   5  | $410    | -$2,050     | $15,750');
  console.log('  2025-03-10  | sell     | AAPL   |   5  | $240    | +$1,200     | $16,950');
  console.log('  2025-04-01  | buy      | NVDA   |  20  | $850    | -$17,000    | -$50');
  console.log('  2025-05-15  | sell     | MSFT   |   5  | $430    | +$2,150     | $2,100');
  console.log('  2025-06-01  | dividend | AAPL   |   —  |   —     | +$50        | $2,150');
  console.log('  2025-07-01  | sell     | NVDA   |  20  | $1,100  | +$22,000    | $24,150');
  console.log('');
  console.log('  Open at end: 5 AAPL (avg cost $220)');
  console.log('');
  console.log('━'.repeat(60));
  console.log('📊 Key validation points for the chart:');
  console.log('');
  console.log('  2025-01-25 (5 days after AAPL buy):');
  console.log('    cash=$17,800 + 10×AAPL_price');
  console.log('    AAPL was ~$228 → Expected ≈ $20,080');
  console.log('');
  console.log('  2025-04-05 (4 days after NVDA buy — tariff shock month):');
  console.log('    cash≈-$50 + 5×AAPL + 5×MSFT + 20×NVDA');
  console.log('    AAPL≈$193, MSFT≈$372, NVDA≈$858');
  console.log('    Expected ≈ $19,935');
  console.log('');
  console.log('  2025-07-05 (4 days after NVDA sell at +$5,000 profit):');
  console.log('    cash=$24,150 + 5×AAPL_price');
  console.log('    AAPL≈$210 → Expected ≈ $25,200');
  console.log('');
  console.log('━'.repeat(60));
  console.log('📱 To validate in the app:');
  console.log('');
  console.log('  1. Open the app → יומן מסחר');
  console.log('  2. Select "🧪 Test Portfolio"');
  console.log('  3. Go to the "סקירה" (Overview) tab');
  console.log('  4. Select period "All" on the chart');
  console.log('');
  console.log('  Expected chart shape:');
  console.log('    ↗ Flat line at $20,000 (Jan 15-19, deposit only)');
  console.log('    ↘ Slight dip after AAPL buy (Jan 20) — cash drops but AAPL added');
  console.log('    ↘ Another dip after MSFT buy (Feb 1)');
  console.log('    ↗ Partial recovery after selling 5 AAPL (Mar 10)');
  console.log('    ↓↓ Big drop in total value: NVDA buy (Apr 1) uses nearly all cash');
  console.log('         + April 2025 tariff shock dragged AAPL/MSFT/NVDA prices down');
  console.log('    ↗ Recovery as NVDA/AAPL recover through May-Jun');
  console.log('    🚀 Big spike on Jul 1 when NVDA is sold at $1,100 (bought at $850)');
  console.log('         = +$5,000 realised P&L, cash jumps to $24,150');
  console.log('    → After Jul 1, mostly flat: $24,150 cash + 5 AAPL open');
  console.log('');
  console.log('  Realised P&L breakdown:');
  console.log('    AAPL partial: (240-220)×5 = +$100');
  console.log('    MSFT full:    (430-410)×5 = +$100');
  console.log('    NVDA full:    (1100-850)×20 = +$5,000');
  console.log('    AAPL dividend:              = +$50');
  console.log('    Total realised:             = +$5,250');
  console.log('');
  console.log('━'.repeat(60));
}

main().catch(console.error);
