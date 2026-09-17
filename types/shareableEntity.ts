/**
 * Multiverse — מודל אחיד לשיתוף ישויות (ציוץ / צ'אט).
 * Snapshot לתצוגה + ref לניווט (כמו TRADE הישן).
 *
 * preview.v=1 — ניתן להרחיב שדות additively בלי לשבור צרכנים ישנים.
 */

import { brandfetchTickerLogoUri } from '../utils/brandfetch';

export type ShareableEntityType =
  | 'person_profile'
  | 'journal_trade'
  | 'news_article'
  | 'earnings_report'
  | 'ticker'
  | 'insider_trade'
  | 'community_portfolio'
  | 'community_post';

export type PersonProfileKind = 'politician' | 'insider' | 'fund_manager';

export interface ShareableEntityRef {
  type: ShareableEntityType;
  id: string;
  extras?: {
    kind?: PersonProfileKind;
    ticker?: string;
    reportDate?: string;
    nameHint?: string;
  };
}

/**
 * מפתחות metrics מוכרים (מחרוזות מוכנות לתצוגה):
 * person: portfolio_value, top_holding, top_holding_value
 * trade:  side, pnl, size, entry, exit, return_pct
 * news:   (נדיר) — עדיף snippet
 */
export interface ShareableEntityPreview {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  badge?: string;
  /** מטריקות מוכנות לתצוגה — ערכים כמחרוזת מעוצבת או מספר */
  metrics?: Record<string, string | number>;
  /** תקציר חדשות / טקסט תומך — מוצג בכרטיס בלי ניווט */
  snippet?: string;
}

export interface ShareableAttachment {
  v: 1;
  ref: ShareableEntityRef;
  preview: ShareableEntityPreview;
  sharedAt: string;
}

export function isShareableAttachment(value: unknown): value is ShareableAttachment {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return false;
  const ref = v.ref as Record<string, unknown> | undefined;
  const preview = v.preview as Record<string, unknown> | undefined;
  return (
    !!ref &&
    typeof ref.type === 'string' &&
    typeof ref.id === 'string' &&
    !!preview &&
    typeof preview.title === 'string' &&
    typeof v.sharedAt === 'string'
  );
}

export function parseEntityAttachmentFromContent(
  content: string | null | undefined
): ShareableAttachment | null {
  const raw = (content ?? '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (isShareableAttachment(parsed.attachment)) return parsed.attachment;
    if (isShareableAttachment(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function serializeEntityMessageContent(
  attachment: ShareableAttachment,
  caption?: string
): string {
  const payload: { attachment: ShareableAttachment; caption?: string } = {
    attachment,
  };
  const c = caption?.trim();
  if (c) payload.caption = c;
  return JSON.stringify(payload);
}

/** תוויות עבריות למפתחות metrics בכרטיס ההטמעה */
export const PREVIEW_METRIC_LABELS: Record<string, string> = {
  portfolio_value: 'שווי תיק',
  top_holding: 'אחזקה מובילה',
  top_holding_value: 'שווי אחזקה',
  side: 'כיוון',
  pnl: 'P&L',
  size: 'גודל',
  entry: 'כניסה',
  exit: 'יציאה',
  return_pct: 'תשואה',
  entry_date: 'תאריך כניסה',
  exit_date: 'תאריך יציאה',
  strategy: 'אסטרטגיה',
  company: 'חברה',
};

function formatUsdCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

function formatUsdMoney(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function clipSnippet(text: string | null | undefined, max = 140): string | undefined {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function kindBadge(kind: PersonProfileKind): string {
  if (kind === 'politician') return 'פוליטיקאי';
  if (kind === 'fund_manager') return 'מנהל קרן';
  return 'בכיר';
}

export function buildPersonAttachment(input: {
  id: string;
  kind: PersonProfileKind;
  name: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ticker?: string | null;
  /** שווי תיק מוערך / מדווח */
  portfolioValue?: number | null;
  /** טיקר אחזקה מובילה */
  topHolding?: string | null;
  /** שווי אחזקה מובילה */
  topHoldingValue?: number | null;
}): ShareableAttachment {
  const metrics: Record<string, string | number> = {};
  if (
    typeof input.portfolioValue === 'number' &&
    Number.isFinite(input.portfolioValue) &&
    input.portfolioValue > 0
  ) {
    metrics.portfolio_value = formatUsdCompact(input.portfolioValue);
  }
  const top = (input.topHolding ?? '').toString().trim().toUpperCase();
  if (top) {
    metrics.top_holding = top;
    if (
      typeof input.topHoldingValue === 'number' &&
      Number.isFinite(input.topHoldingValue) &&
      input.topHoldingValue > 0
    ) {
      metrics.top_holding_value = formatUsdCompact(input.topHoldingValue);
    }
  }

  const role = (input.subtitle ?? '').toString().trim() || undefined;
  const name = (input.name ?? '').toString().trim() || 'פרופיל';

  return {
    v: 1,
    ref: {
      type: 'person_profile',
      id: String(input.id ?? '').trim(),
      extras: {
        kind: input.kind,
        ...(input.ticker ? { ticker: String(input.ticker) } : {}),
        nameHint: name,
      },
    },
    preview: {
      title: name,
      subtitle: role,
      imageUrl: input.imageUrl ?? null,
      badge: kindBadge(input.kind),
      ...(Object.keys(metrics).length ? { metrics } : {}),
    },
    sharedAt: new Date().toISOString(),
  };
}

/** תשואה: קודם מהמסד, אחרת חישוב ממחירי כניסה/יציאה (כמו ביומן) */
function resolveTradeReturnPct(trade: {
  direction: 'long' | 'short' | string;
  entry_price?: number | null;
  exit_price?: number | null;
  return_percentage?: number | null;
  /** שמות חלופיים אם קיימים באובייקט */
  pnlPercent?: number | null;
  returnPct?: number | null;
}): number | null {
  const stored =
    (typeof trade.return_percentage === 'number' && Number.isFinite(trade.return_percentage)
      ? trade.return_percentage
      : null) ??
    (typeof trade.returnPct === 'number' && Number.isFinite(trade.returnPct)
      ? trade.returnPct
      : null) ??
    (typeof trade.pnlPercent === 'number' && Number.isFinite(trade.pnlPercent)
      ? trade.pnlPercent
      : null);
  if (stored != null) return stored;

  const entry = Number(trade.entry_price);
  const exit = Number(trade.exit_price);
  if (!(entry > 0) || !Number.isFinite(exit)) return null;
  const dir = String(trade.direction || '').toLowerCase();
  return dir === 'short'
    ? ((entry - exit) / entry) * 100
    : ((exit - entry) / entry) * 100;
}

export function buildTradeAttachment(trade: {
  id: string;
  symbol: string;
  direction: 'long' | 'short' | string;
  entry_price?: number | null;
  exit_price?: number | null;
  quantity?: number | null;
  entry_date?: string | null;
  exit_date?: string | null;
  pnl?: number | null;
  return_percentage?: number | null;
  pnlPercent?: number | null;
  returnPct?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  /** שם חברה אם קיים בצד הקורא */
  company_name?: string | null;
  companyName?: string | null;
  strategy_name?: string | null;
}): ShareableAttachment {
  const dir = String(trade.direction || '').toLowerCase() === 'short' ? 'short' : 'long';
  const sideLabel = dir === 'long' ? 'Long' : 'Short';
  const symbol = String(trade.symbol ?? '').trim().toUpperCase() || 'TRADE';
  const pnl = typeof trade.pnl === 'number' && Number.isFinite(trade.pnl) ? trade.pnl : null;
  const ret = resolveTradeReturnPct(trade);
  const qty =
    typeof trade.quantity === 'number' && Number.isFinite(trade.quantity)
      ? trade.quantity
      : null;
  const company =
    (trade.company_name ?? trade.companyName ?? '').toString().trim() || undefined;
  const strategy = (trade.strategy_name ?? '').toString().trim() || undefined;
  const logoUrl = brandfetchTickerLogoUri(symbol);

  const metrics: Record<string, string | number> = {
    side: sideLabel,
  };
  if (pnl != null) {
    const pnlAbs = formatUsdMoney(Math.abs(pnl));
    metrics.pnl = `${pnl >= 0 ? '+' : '−'}${pnlAbs}`;
  }
  if (ret != null) {
    metrics.return_pct = `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`;
  }
  if (qty != null) {
    metrics.size = qty;
  }
  if (typeof trade.entry_price === 'number' && Number.isFinite(trade.entry_price)) {
    metrics.entry = formatUsdMoney(trade.entry_price);
  }
  if (typeof trade.exit_price === 'number' && Number.isFinite(trade.exit_price)) {
    metrics.exit = formatUsdMoney(trade.exit_price);
  }
  const exitDate = trade.exit_date?.slice(0, 10);
  const entryDate = trade.entry_date?.slice(0, 10);
  if (exitDate && /^\d{4}-\d{2}-\d{2}$/.test(exitDate)) {
    const [y, m, d] = exitDate.split('-');
    metrics.exit_date = `${d}/${m}/${y}`;
  } else if (entryDate && /^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    const [y, m, d] = entryDate.split('-');
    metrics.entry_date = `${d}/${m}/${y}`;
  }
  if (company) metrics.company = company;
  if (strategy) metrics.strategy = strategy;

  const subtitleParts: string[] = [];
  if (company) subtitleParts.push(company);

  return {
    v: 1,
    ref: {
      type: 'journal_trade',
      id: trade.id,
      extras: { ticker: symbol },
    },
    preview: {
      title: symbol,
      ...(subtitleParts.length ? { subtitle: subtitleParts.join(' · ') } : {}),
      imageUrl: logoUrl,
      badge: dir === 'long' ? 'LONG' : 'SHORT',
      metrics,
    },
    sharedAt: new Date().toISOString(),
  };
}

export function buildNewsAttachment(article: {
  id?: string | null;
  title?: string | null;
  /** app_news_clean — label / text במקום title / content */
  label?: string | null;
  summary?: string | null;
  content?: string | null;
  text?: string | null;
  source?: string | null;
  image_url?: string | null;
  img?: string | null;
  published_at?: string | null;
}): ShareableAttachment {
  const asStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const title =
    asStr(article.title).trim() ||
    asStr(article.label).trim() ||
    asStr(article.text).trim() ||
    'חדשה';
  const bodyText =
    asStr(article.summary) || asStr(article.content) || asStr(article.text);
  const snippet =
    clipSnippet(article.summary) ||
    clipSnippet(bodyText, 120) ||
    undefined;
  const source = asStr(article.source).trim();
  const imageUrl = article.image_url ?? article.img ?? null;
  const id = asStr(article.id).trim() || `news-${Date.now()}`;

  return {
    v: 1,
    ref: {
      type: 'news_article',
      id,
    },
    preview: {
      title,
      subtitle: source || undefined,
      imageUrl,
      badge: 'חדשות',
      ...(snippet ? { snippet } : {}),
    },
    sharedAt: new Date().toISOString(),
  };
}
