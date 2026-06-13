/**
 * darkPoolAiInsights.ts
 * -----------------------------------------------------------------------------
 * סיכומי AI לסיגנלי Dark Pool — Pure TypeScript.
 *
 * הקובץ מבצע templating דטרמיניסטי עם variants כדי שלא נחזיר אותה מחרוזת
 * פעם אחר פעם. אם יוגדר `AI_INSIGHTS_PROVIDER=openai|gemini` נשתמש בו דרך REST,
 * אחרת ניפול אוטומטית ל-template הדטרמיניסטי.
 *
 * הפונקציה pure (כל הסטטוס נשמר במשתנים מקומיים) ולכן בטוחה גם בלקוח וגם ב-Edge.
 */

import type {
  DarkPoolSignalMetrics,
  DarkPoolSignalType,
} from '../../types/darkpool.types';

export interface AiInsightInput {
  ticker: string;
  companyName?: string | null;
  signalType: DarkPoolSignalType;
  metrics: DarkPoolSignalMetrics;
  score: number;
}

export interface AiInsightDeps {
  /** מותר להזריק fetch (לסטאב/Edge) */
  fetcher?: typeof fetch;
  /** API key חליפי. */
  apiKey?: string;
  /** מודל ספציפי (gpt-4o-mini ברירת מחדל). */
  model?: string;
  /** אילוץ deterministic template (מתעלם מ-LLM). */
  forceTemplate?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateAiInsight(
  input: AiInsightInput,
  deps: AiInsightDeps = {}
): Promise<string> {
  if (deps.forceTemplate) return buildTemplateInsight(input);
  const provider = readEnv('AI_INSIGHTS_PROVIDER')?.toLowerCase();
  const apiKey = deps.apiKey || readEnv('OPENAI_API_KEY') || '';
  if (!provider || !apiKey) return buildTemplateInsight(input);
  try {
    if (provider === 'openai') {
      return await openAiSummary(input, apiKey, deps);
    }
  } catch {
    // ignore — fallback
  }
  return buildTemplateInsight(input);
}

// ---------------------------------------------------------------------------
// Deterministic template
// ---------------------------------------------------------------------------

export function buildTemplateInsight(input: AiInsightInput): string {
  const { ticker, companyName, signalType, metrics } = input;
  const company = companyName || ticker;
  const premium = formatUsd(metrics.premium_total ?? 0);
  const buy = metrics.premium_buy ? formatUsd(metrics.premium_buy) : null;
  const sell = metrics.premium_sell ? formatUsd(metrics.premium_sell) : null;
  const prints = metrics.prints || metrics.whale_count;
  const rel = metrics.relative_volume
    ? `${metrics.relative_volume.toFixed(1)}×`
    : null;

  switch (signalType) {
    case 'UNUSUAL_VOLUME':
      return `סוחרים מוסדיים הזרימו ${premium} ב-Dark Pool של ${company} (${ticker})${
        rel ? `, פעילות של ${rel} מהממוצע היומי` : ''
      }. נפח חריג שמרמז על עניין מצטבר במניה.`;
    case 'SWEEP':
      return `${prints || 'מספר'} הדפסות אגרסיביות נצפו ב-Dark Pool של ${company} בחלון של 5 דקות, בסך ${premium}${
        buy && sell ? ` (קנייה ${buy} מול מכירה ${sell})` : ''
      }. דפוס סוויפ קלאסי של מוסדי שמבצע ביצוע מהיר.`;
    case 'WHALE':
      return `הדפסת ענק של ${premium} זוהתה ב-Dark Pool של ${company}. גודל שכזה מצביע על מעורבות של whale או הדג רחב אחד שמעמיד פוזיציה מאסיבית.`;
    case 'HIDDEN_ACCUMULATION': {
      const net = (metrics.premium_buy ?? 0) - (metrics.premium_sell ?? 0);
      return `סוחרים מוסדיים צברו נטו ${formatUsd(net)} ב-${company} (${ticker}) ב-3 הימים האחרונים, מתחת לרדאר של השוק הציבורי. הצבירה השקטה הזו לרוב מקדימה תנועה חזקה.`;
    }
    case 'INSIDER_DARKPOOL_CONFLUENCE': {
      const days = metrics.insider_days_ago ?? 0;
      const insider = metrics.insider_name || 'בכיר בחברה';
      const value = metrics.insider_value
        ? formatUsd(metrics.insider_value)
        : '';
      return `${insider} רכש ${value} ב-${company} (${ticker}) לפני ${days} ימים, ובמקביל זוהתה צבירה של ${premium} ב-Dark Pool. כפילות הסיגנלים — מוסדי + פנים — היא אחת הקומבינציות החזקות ביותר במערכת.`;
    }
    default:
      return `סיגנל ${signalType} זוהה על ${company} (${ticker}) — premium ${premium}.`;
  }
}

// ---------------------------------------------------------------------------
// OpenAI implementation
// ---------------------------------------------------------------------------

async function openAiSummary(
  input: AiInsightInput,
  apiKey: string,
  deps: AiInsightDeps
): Promise<string> {
  const fetcher = deps.fetcher || fetch;
  const model = deps.model || 'gpt-4o-mini';
  const body = {
    model,
    temperature: 0.4,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content:
          'You are a financial intelligence assistant for an Israeli retail-trader app. Reply in Hebrew, in 1-2 short sentences (max 240 characters). Be factual, no emojis, no disclaimers.',
      },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
  };
  const res = await fetcher('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openai error: ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('openai empty');
  return text.replace(/\s+$/g, '').slice(0, 280);
}

function buildPrompt(input: AiInsightInput): string {
  const m = input.metrics;
  const facts = [
    `Ticker: ${input.ticker}`,
    input.companyName ? `Company: ${input.companyName}` : null,
    `Signal: ${input.signalType}`,
    `Score: ${input.score}`,
    m.premium_total ? `Total premium: $${m.premium_total}` : null,
    m.premium_buy ? `Buy premium: $${m.premium_buy}` : null,
    m.premium_sell ? `Sell premium: $${m.premium_sell}` : null,
    m.prints ? `Prints: ${m.prints}` : null,
    m.relative_volume ? `Relative volume: ${m.relative_volume}` : null,
    m.insider_name ? `Insider: ${m.insider_name}` : null,
    m.insider_value ? `Insider value: $${m.insider_value}` : null,
    m.insider_days_ago != null ? `Insider days ago: ${m.insider_days_ago}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return `סכם בעברית את הסיגנל הבא לסוחרים פרטיים, משפט אחד:\n${facts}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readEnv(key: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = (globalThis as any).Deno;
    if (d?.env?.get) return d.env.get(key) || undefined;
  } catch {
    // ignore
  }
  if (typeof process !== 'undefined' && process.env) {
    const v = (process.env as Record<string, string | undefined>)[key];
    return v && v.trim().length > 0 ? v : undefined;
  }
  return undefined;
}

function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return '$0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
