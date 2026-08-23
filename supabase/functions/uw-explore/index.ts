// uw-explore — מסך גילוי: Quiver (קונגרס) + UW/DB (בכירים)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.94.1';
import {
  dedupeCongressTrades,
  fetchUwCongressRecent,
  fetchUwCongressUnusualTrades,
  fetchUwInsiderTransactions,
  fetchUwInsidersForTicker,
  fetchUwPoliticians,
  mapUnusualTradeToCongress,
  uwCongressPersonName,
  resolveUwLogoUrl,
  type UwCongressTrade,
  type UwInsiderTradeAgg,
  type UwPolitician,
} from '../_shared/unusualWhales.ts';
import {
  fetchQuiverCongressPoliticians,
  fetchQuiverLiveCongressTrades,
  getCongressTradesProvider,
  isQuiverEquityTrade,
  quiverPoliticianNetWorth,
  resolveQuiverApiKey,
  type QuiverCongressTrade,
  type QuiverPolitician,
} from '../_shared/quiverQuant.ts';
import { metricsFromCongressTrades } from '../_shared/congressPortfolio.ts';
import {
  createServiceSupabase,
  loadCongressTradesFromDb,
  loadSnapshot,
  loadSnapshotStale,
  saveSnapshot,
} from '../_shared/uwDbCache.ts';
import { buildExploreFromDb } from '../_shared/exploreFromDb.ts';
import { isSecProductionMode } from '../_shared/darkPoolMode.ts';

const EXPLORE_CACHE_KEY = 'explore_v3';
const EXPLORE_FRESH_MS = 30 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONGRESS_PHOTO = 'https://unitedstates.github.io/images/congress/225x275';

const EXECUTIVE_PHOTO: Record<string, string> = {
  'donald j trump': 'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg',
  'donald trump': 'https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg',
};

interface ExplorePerson {
  id: string;
  name: string;
  subtitle: string;
  image_url: string | null;
  metric?: string;
  metric_label?: string;
  activity_score?: number;
  sparkline_values?: number[];
  kind: 'politician' | 'insider';
  ticker?: string;
  followers_count?: number;
  portfolio_value?: number;
  returns?: Record<string, number | null>;
}

interface ExplorePayload {
  most_followed: ExplorePerson[];
  executives: ExplorePerson[];
  top_active: ExplorePerson[];
  recently_active: ExplorePerson[];
  insiders_with_photo: ExplorePerson[];
  warnings: string[];
  fetched_at: string;
  source: 'quiverquant' | 'unusualwhales' | 'public_filings';
}

let exploreCache: { at: number; payload: ExplorePayload } | null = null;
const EXPLORE_CACHE_MS = 10 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const secMode = isSecProductionMode();
  const congressProvider = getCongressTradesProvider();
  const quiverKey = resolveQuiverApiKey();
  const uwKey = Deno.env.get('UNUSUAL_WHALES_API_KEY') || '';

  if (!secMode) {
    if (congressProvider === 'quiverquant' && !quiverKey) {
      return json({ error: 'QUIVER_API_KEY missing' }, 400);
    }
    if (congressProvider === 'unusualwhales' && !uwKey) {
      return json({ error: 'UNUSUAL_WHALES_API_KEY missing' }, 400);
    }
  }

  let force = false;
  try {
    const body = await req.json();
    force = body?.force === true;
  } catch {
    /* empty body */
  }

  const supabase = createServiceSupabase();

  if (!force) {
    const fresh = await loadSnapshot<ExplorePayload>(
      supabase,
      EXPLORE_CACHE_KEY,
      EXPLORE_FRESH_MS
    );
    if (fresh) {
      exploreCache = { at: Date.now(), payload: fresh.payload };
      return json(fresh.payload, 200);
    }
    const stale = await loadSnapshotStale<ExplorePayload>(supabase, EXPLORE_CACHE_KEY);
    if (stale) {
      exploreCache = { at: Date.now(), payload: stale.payload };
      return json(stale.payload, 200);
    }
  }

  if (
    !force &&
    exploreCache &&
    Date.now() - exploreCache.at < EXPLORE_CACHE_MS
  ) {
    return json(exploreCache.payload, 200);
  }

  try {
    const payload: ExplorePayload = secMode
      ? await buildExploreFromDb(supabase)
      : congressProvider === 'quiverquant'
        ? await buildExploreFromQuiver(quiverKey, uwKey)
        : await buildExplore(uwKey);
    exploreCache = { at: Date.now(), payload };
    await saveSnapshot(supabase, EXPLORE_CACHE_KEY, payload);
    return json(payload, 200);
  } catch (e) {
    console.error('uw-explore', e);
    const stale = await loadSnapshotStale<ExplorePayload>(supabase, EXPLORE_CACHE_KEY);
    if (stale) return json(stale.payload, 200);
    if (exploreCache) return json(exploreCache.payload, 200);
    return json({ error: (e as Error).message }, 500);
  }
});

async function buildExploreFromQuiver(
  quiverKey: string,
  uwKey: string
): Promise<ExplorePayload> {
  const warnings: string[] = [];
  const supabase = createServiceClient();

  const [politicianRows, tradeRows] = await Promise.all([
    fetchQuiverCongressPoliticians(quiverKey, { pageSize: 50, maxPages: 3 }).catch((e) => {
      console.warn('uw-explore quiver politicians', e);
      return [] as QuiverPolitician[];
    }),
    fetchQuiverLiveCongressTrades(quiverKey).catch((e) => {
      console.warn('uw-explore quiver trades', e);
      return [] as QuiverCongressTrade[];
    }),
  ]);

  let equityTrades = tradeRows.filter(isQuiverEquityTrade);

  if (!equityTrades.length) {
    const dbRows = await loadCongressTradesFromDb(supabase, 200).catch(() => []);
    if (dbRows.length) {
      equityTrades = dbRows.map((r) => ({
        BioGuideID: r.politician_id,
        Representative: r.politician_name,
        Ticker: r.ticker,
        Transaction: r.transaction_type === 'sell' ? 'Sale' : 'Purchase',
        Range: r.amount_label ?? undefined,
        TransactionDate: r.transaction_date,
        ReportDate: r.filed_at.slice(0, 10),
        House: undefined,
        Party: undefined,
      }));
    }
  }

  if (!politicianRows.length && !equityTrades.length) {
    warnings.push('אין נתוני קונגרס זמינים כרגע — נסה לרענן מאוחר יותר.');
  } else if (!politicianRows.length) {
    // רשימת פוליטיקאים מ-Quiver נכשלה — מציגים מעסקאות/DB בלבד (ללא באנר).
    console.warn('uw-explore: politicians list skipped, using trades only');
  }

  const congressTrades = equityTrades.map(quiverToUwCongressTrade);
  const bioByPolitician = new Map<string, string>();
  for (const p of politicianRows) {
    const id = String(p.BioGuideID ?? '').trim();
    if (id) bioByPolitician.set(id, id);
  }

  const sparkByPolitician = buildPoliticianSparklines(congressTrades);
  const agg = aggregateQuiverPoliticians(politicianRows, equityTrades);

  const withPhoto = (list: PoliticianAgg[]) =>
    list.filter((p) => !!politicianPhoto(p, bioByPolitician));

  const congressRanked = withPhoto(agg).sort((a, b) => b.trade_count - a.trade_count);

  let insidersDb = await buildInsidersFromDb(supabase);
  if (uwKey) {
    const insiderTx = await fetchUwInsiderTransactions(uwKey, {
      limit: 150,
      transactionCodes: ['P'],
      group: true,
      commonStockOnly: true,
    }).catch((e) => {
      console.warn('uw-explore insider uw', e);
      return [] as UwInsiderTradeAgg[];
    });
    const insidersUw = await buildInsidersFromUwTx(uwKey, insiderTx);
    insidersDb = mergeInsiders(insidersDb, insidersUw);
  }
  const insiders = insidersDb.slice(0, 60);

  const trending = congressRanked.slice(0, 30).map((p) => ({
    ...toPerson(p, bioByPolitician, sparkByPolitician),
    metric: `${p.trade_count}`,
    metric_label: 'עסקאות',
    activity_score: p.trade_count,
  }));

  const followerMap = await loadFollowerCounts(supabase);

  let mostFollowed = congressRanked.slice(0, 36).map((p) => {
    const person = toPerson(p, bioByPolitician, sparkByPolitician);
    const fc = followerMap.get(`politician:${p.id}`) ?? 0;
    return {
      ...person,
      followers_count: fc,
      metric:
        fc > 0
          ? fc >= 1000
            ? `${(fc / 1000).toFixed(0)}K`
            : String(fc)
          : `${p.trade_count}`,
      metric_label: fc > 0 ? 'עוקבים' : 'עסקאות',
    };
  });

  mostFollowed = [
    ...(await enrichMostFollowedPortfolio(mostFollowed.slice(0, 6), congressTrades)),
    ...mostFollowed.slice(6),
  ];

  let topActive = enrichTopPerformersFromQuiver(
    trending.slice(0, 24),
    equityTrades
  );
  topActive = await enrichTopPerformers(topActive, congressTrades);

  return {
    most_followed: mostFollowed,
    executives: [],
    top_active: topActive,
    recently_active: withPhoto(agg)
      .filter((p) => p.days_since != null)
      .sort((a, b) => (a.days_since ?? 999) - (b.days_since ?? 999))
      .slice(0, 48)
      .map((p) => ({
        ...toPerson(p, bioByPolitician, sparkByPolitician),
        subtitle:
          p.days_since != null ? `דיווח לפני ${p.days_since} ימים` : p.subtitle,
      })),
    insiders_with_photo: insiders,
    warnings: sanitizeExploreWarnings(warnings),
    fetched_at: new Date().toISOString(),
    source: 'quiverquant',
  };
}

function quiverToUwCongressTrade(t: QuiverCongressTrade): UwCongressTrade {
  return {
    politician_id: t.BioGuideID,
    politician: t.Representative,
    ticker: t.Ticker,
    txn_type: t.Transaction,
    amounts: t.Range,
    transaction_date: t.TransactionDate,
    filed_at_date: t.ReportDate ?? t.last_modified,
    member_type: t.House,
  };
}

function aggregateQuiverPoliticians(
  politicians: QuiverPolitician[],
  trades: QuiverCongressTrade[]
): PoliticianAgg[] {
  const map = new Map<string, PoliticianAgg>();

  for (const row of politicians) {
    const id = String(row.BioGuideID ?? '').trim();
    const name = String(row.Name ?? '').trim();
    if (!id || !name) continue;
    const chamber = row.Chamber ?? row.House;
    map.set(id, {
      id,
      name,
      party: row.Party,
      chamber,
      bioguide_id: id,
      trade_count: Number(row.TradeCount) || 0,
      days_since: parseDaysSince(row.LastTraded),
      subtitle: formatSubtitle(row.Party, chamber, Number(row.TradeCount) || undefined),
    });
  }

  for (const t of trades) {
    const id = String(t.BioGuideID ?? '').trim();
    const name = String(t.Representative ?? '').trim();
    if (!id) continue;
    const days = parseDaysSince(t.ReportDate ?? t.TransactionDate);
    const cur = map.get(id);
    if (cur) {
      cur.trade_count += 1;
      if (days != null && (cur.days_since == null || days < cur.days_since)) {
        cur.days_since = days;
      }
    } else if (name) {
      map.set(id, {
        id,
        name,
        party: t.Party,
        chamber: t.House,
        bioguide_id: id,
        trade_count: 1,
        days_since: days,
        subtitle: formatSubtitle(t.Party, t.House, 1),
      });
    }
  }

  return mergePoliticiansByName(Array.from(map.values()));
}

function normalizePolName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ');
}

function mergePoliticiansByName(list: PoliticianAgg[]): PoliticianAgg[] {
  const byName = new Map<string, PoliticianAgg>();
  for (const p of list) {
    const key = normalizePolName(p.name);
    if (!key) continue;
    const cur = byName.get(key);
    if (!cur) {
      byName.set(key, { ...p });
      continue;
    }
    const curBio = /^[A-Z]\d{6}$/.test(cur.id);
    const pBio = /^[A-Z]\d{6}$/.test(p.id);
    const primary =
      pBio && !curBio ? p : curBio && !pBio ? cur : p.trade_count > cur.trade_count ? p : cur;
    const secondary = primary === p ? cur : p;
    byName.set(key, {
      ...primary,
      trade_count: primary.trade_count + secondary.trade_count,
      days_since:
        primary.days_since != null && secondary.days_since != null
          ? Math.min(primary.days_since, secondary.days_since)
          : primary.days_since ?? secondary.days_since,
    });
  }
  return Array.from(byName.values());
}

function enrichTopPerformersFromQuiver(
  people: ExplorePerson[],
  trades: QuiverCongressTrade[]
): ExplorePerson[] {
  const returnsByPol = new Map<string, number[]>();
  for (const t of trades) {
    const id = String(t.BioGuideID ?? '').trim();
    const pc = t.ExcessReturn ?? t.PriceChange;
    if (!id || pc == null || !Number.isFinite(pc)) continue;
    const list = returnsByPol.get(id) ?? [];
    list.push(Number(pc));
    returnsByPol.set(id, list);
  }

  return people.map((person) => {
    const vals = returnsByPol.get(person.id);
    if (!vals?.length) return person;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      ...person,
      metric: `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`,
      metric_label: 'מאז עסקאות',
      returns: { ALL: avg },
    };
  });
}

async function buildExplore(apiKey: string): Promise<ExplorePayload> {
  const warnings: string[] = [];
  const politicians = await fetchUwPoliticians(apiKey, 36).catch((e) => {
    console.warn('uw-explore uw politicians', e);
    return [] as UwPolitician[];
  });
  const [congressBase, unusualRaw] = await Promise.all([
    fetchUwCongressRecent(apiKey, 200).catch((e) => {
      console.warn('uw-explore uw congress', e);
      return [] as UwCongressTrade[];
    }),
    fetchUwCongressUnusualTrades(apiKey, { limit: 120 }).catch((e) => {
      console.warn('uw-explore uw unusual', e);
      return [];
    }),
  ]);
  const congressTrades = dedupeCongressTrades([
    ...congressBase,
    ...unusualRaw.map(mapUnusualTradeToCongress),
  ]);
  if (!congressTrades.length) {
    const dbRows = await loadCongressTradesFromDb(createServiceClient(), 200).catch(() => []);
    if (dbRows.length) {
      for (const r of dbRows) {
        congressTrades.push({
          politician_id: r.politician_id,
          politician_name: r.politician_name,
          ticker: r.ticker,
          txn_type: r.transaction_type === 'sell' ? 'Sell' : 'Buy',
          amounts: r.amount_label ?? undefined,
          transaction_date: r.transaction_date,
          filed_at_date: r.filed_at.slice(0, 10),
        });
      }
    } else {
      warnings.push('אין נתוני קונגרס זמינים כרגע.');
    }
  }
  await delay(350);
  const insiderTx = await fetchUwInsiderTransactions(apiKey, {
    limit: 150,
    transactionCodes: ['P'],
    group: true,
    commonStockOnly: true,
  }).catch((e) => {
    console.warn('uw-explore insider uw buildExplore', e);
    return [] as UwInsiderTradeAgg[];
  });

  await delay(350);

  const bioByPolitician = buildBioguideMap(politicians);
  const sparkByPolitician = buildPoliticianSparklines(congressTrades);
  const agg = aggregatePoliticians(politicians, congressTrades);

  const withPhoto = (list: PoliticianAgg[]) =>
    list.filter((p) => !!politicianPhoto(p, bioByPolitician));

  const executives = withPhoto(agg.filter((p) => p.chamber === 'executive'))
    .sort((a, b) => b.trade_count - a.trade_count)
    .slice(0, 20)
    .map((p) => toPerson(p, bioByPolitician, sparkByPolitician));

  const congressRanked = withPhoto(agg.filter((p) => p.chamber !== 'executive'))
    .sort((a, b) => b.trade_count - a.trade_count);

  const supabase = createServiceClient();
  const insidersDb = await buildInsidersFromDb(supabase);
  const insidersUw = await buildInsidersFromUwTx(apiKey, insiderTx);
  const insiders = mergeInsiders(insidersDb, insidersUw).slice(0, 60);

  const trending = congressRanked.slice(0, 30).map((p) => ({
    ...toPerson(p, bioByPolitician, sparkByPolitician),
    metric: `${p.trade_count}`,
    metric_label: 'עסקאות',
    activity_score: p.trade_count,
  }));

  const followerMap = await loadFollowerCounts(supabase);

  let mostFollowed = congressRanked.slice(0, 36).map((p) => {
    const person = toPerson(p, bioByPolitician, sparkByPolitician);
    const fc = followerMap.get(`politician:${p.id}`) ?? 0;
    return {
      ...person,
      followers_count: fc,
      metric:
        fc > 0
          ? fc >= 1000
            ? `${(fc / 1000).toFixed(0)}K`
            : String(fc)
          : undefined,
      metric_label: fc > 0 ? 'עוקבים' : undefined,
    };
  });

  mostFollowed = [
    ...(await enrichMostFollowedPortfolio(mostFollowed.slice(0, 6), congressTrades)),
    ...mostFollowed.slice(6),
  ];

  let topActive = await enrichTopPerformers(trending.slice(0, 24), congressTrades);

  return {
    most_followed: mostFollowed,
    executives,
    top_active: topActive,
    recently_active: withPhoto(agg)
      .filter((p) => p.days_since != null)
      .sort((a, b) => (a.days_since ?? 999) - (b.days_since ?? 999))
      .slice(0, 48)
      .map((p) => ({
        ...toPerson(p, bioByPolitician, sparkByPolitician),
        subtitle:
          p.days_since != null ? `דיווח לפני ${p.days_since} ימים` : p.subtitle,
      })),
    insiders_with_photo: insiders,
    warnings: sanitizeExploreWarnings(warnings),
    fetched_at: new Date().toISOString(),
    source: 'unusualwhales',
  };
}

interface PoliticianAgg {
  id: string;
  name: string;
  party?: string;
  chamber?: string;
  bioguide_id?: string;
  trade_count: number;
  days_since: number | null;
  subtitle: string;
}

function buildBioguideMap(politicians: UwPolitician[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of politicians) {
    const id = String(p.politician_id ?? p.id ?? '').trim();
    const bg = p.bioguide_id?.trim();
    if (id && bg) map.set(id, bg);
  }
  return map;
}

function politicianPhoto(
  p: PoliticianAgg,
  bioMap: Map<string, string>
): string | null {
  const bg = p.bioguide_id?.trim() || bioMap.get(p.id);
  if (bg) return `${CONGRESS_PHOTO}/${bg}.jpg`;
  return EXECUTIVE_PHOTO[normalizeNameKey(p.name)] ?? null;
}

function buildPoliticianSparklines(trades: UwCongressTrade[]): Map<string, number[]> {
  const perPol = new Map<string, Map<string, number>>();
  for (const t of trades) {
    const id = String(t.politician_id ?? '').trim();
    const week = String(t.filed_at_date ?? t.transaction_date ?? '').slice(0, 7);
    if (!id || !week) continue;
    let buckets = perPol.get(id);
    if (!buckets) {
      buckets = new Map();
      perPol.set(id, buckets);
    }
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }
  const out = new Map<string, number[]>();
  for (const [id, buckets] of perPol) {
    const counts = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([, c]) => c);
    if (counts.length < 2) {
      out.set(id, counts.length ? [counts[0], counts[0]] : [0, 0]);
      continue;
    }
    let sum = 0;
    out.set(
      id,
      counts.map((c) => {
        sum += c;
        return sum;
      })
    );
  }
  return out;
}

function toPerson(
  p: PoliticianAgg,
  bioMap: Map<string, string>,
  sparkMap: Map<string, number[]>
): ExplorePerson {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    image_url: politicianPhoto(p, bioMap),
    kind: 'politician',
    sparkline_values: sparkMap.get(p.id),
    activity_score: p.trade_count,
  };
}

function aggregatePoliticians(
  politicians: UwPolitician[],
  trades: UwCongressTrade[]
): PoliticianAgg[] {
  const map = new Map<string, PoliticianAgg>();

  for (const row of politicians) {
    const id = String(row.politician_id ?? row.id ?? '').trim();
    const name = String(row.name ?? '').trim();
    if (!id || !name) continue;
    map.set(id, {
      id,
      name,
      party: row.party,
      chamber: row.chamber,
      bioguide_id: row.bioguide_id,
      trade_count: Number(row.trade_count) || 0,
      days_since: parseDaysSince(row.last_trade_date),
      subtitle: formatSubtitle(row.party, row.chamber, row.trade_count),
    });
  }

  for (const t of trades) {
    const id = String(t.politician_id ?? '').trim();
    const name = uwCongressPersonName(t);
    if (!id) continue;
    const days = parseDaysSince(t.filed_at_date ?? t.transaction_date);
    const cur = map.get(id);
    if (cur) {
      cur.trade_count += 1;
      if (days != null && (cur.days_since == null || days < cur.days_since)) {
        cur.days_since = days;
      }
    } else if (name) {
      map.set(id, {
        id,
        name,
        chamber: t.member_type,
        trade_count: 1,
        days_since: days,
        subtitle: t.member_type ?? 'קונגרס',
      });
    }
  }

  return Array.from(map.values());
}

async function buildInsidersFromUwTx(
  apiKey: string,
  txs: UwInsiderTradeAgg[]
): Promise<ExplorePerson[]> {
  const ranked = txs
    .filter((t) => t.ticker && t.owner_name && !t.is_10b5_1)
    .slice(0, 120);

  const tickers = Array.from(
    new Set(ranked.map((t) => (t.ticker || '').toUpperCase()).filter(Boolean))
  ).slice(0, 8);

  const rosterByTicker = new Map<string, Awaited<ReturnType<typeof fetchUwInsidersForTicker>>>();
  for (const ticker of tickers) {
    try {
      rosterByTicker.set(ticker, await fetchUwInsidersForTicker(apiKey, ticker));
    } catch (e) {
      console.warn(`roster ${ticker}`, e);
      rosterByTicker.set(ticker, []);
    }
    await delay(350);
  }

  const out: ExplorePerson[] = [];
  const seen = new Set<string>();

  for (const tx of ranked) {
    const ticker = (tx.ticker || '').toUpperCase();
    const name = tx.owner_name?.trim();
    if (!ticker || !name) continue;
    const key = `${ticker}:${name}`;
    if (seen.has(key)) continue;

    const roster = rosterByTicker.get(ticker) ?? [];
    const match = roster.find((r) => namesLooseMatch(name, r.display_name || r.name || ''));
    const image_url = match ? resolveUwLogoUrl(match) : null;

    seen.add(key);
    out.push({
      id: key,
      name: formatInsiderName(name),
      subtitle: [tx.officer_title, ticker].filter(Boolean).join(' · '),
      image_url,
      kind: 'insider',
      ticker,
      activity_score: Number(tx.amount) || Number(tx.transactions) || 1,
    });
    if (out.length >= 60) break;
  }

  return out;
}

function formatInsiderName(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  if (parts.length <= 1) return raw;
  const last = parts[0];
  const rest = parts.slice(1).join(' ');
  return `${rest} ${last}`.trim();
}

function namesLooseMatch(a: string, b: string): boolean {
  const ta = new Set(normalizeNameKey(a).split(' ').filter((t) => t.length > 1));
  const tb = new Set(normalizeNameKey(b).split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap >= Math.min(2, Math.min(ta.size, tb.size));
}

async function buildInsidersFromDb(
  supabase: ReturnType<typeof createClient>
): Promise<ExplorePerson[]> {
  const { data, error } = await supabase
    .from('dark_pool_insider_buys')
    .select('insider_name, insider_logo_url, ticker, insider_role')
    .order('filed_at', { ascending: false })
    .limit(250);

  if (error) return [];

  const out: ExplorePerson[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const name = String(row.insider_name ?? '').trim();
    const ticker = String(row.ticker ?? '').toUpperCase();
    const image_url = String(row.insider_logo_url ?? '').trim() || null;
    if (!name || !ticker) continue;
    const key = `${ticker}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key,
      name: formatInsiderName(name),
      subtitle: [row.insider_role, ticker].filter(Boolean).join(' · '),
      image_url,
      kind: 'insider',
      ticker,
    });
  }
  return out;
}

function mergeInsiders(a: ExplorePerson[], b: ExplorePerson[]): ExplorePerson[] {
  const seen = new Set(a.map((p) => p.id));
  return [...a, ...b.filter((p) => !seen.has(p.id) && !seen.add(p.id))];
}

function formatSubtitle(
  party?: string,
  chamber?: string,
  tradeCount?: number
): string {
  const parts: string[] = [];
  if (party) parts.push(party);
  if (chamber) parts.push(chamber);
  if (tradeCount) parts.push(`${tradeCount} עסקאות`);
  return parts.join(' · ') || 'פוליטיקאי';
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseDaysSince(iso: unknown): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const d = Date.parse(iso.slice(0, 10));
  if (!Number.isFinite(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / 86400000));
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadFollowerCounts(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data } = await supabase
    .from('dark_pool_followed_investors')
    .select('person_id, kind');
  for (const row of data ?? []) {
    const key = `${row.kind}:${row.person_id}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

async function enrichMostFollowedPortfolio(
  people: ExplorePerson[],
  congressTrades: UwCongressTrade[]
): Promise<ExplorePerson[]> {
  const out: ExplorePerson[] = [];
  for (const person of people) {
    if (person.kind !== 'politician') {
      out.push(person);
      continue;
    }
    const mine = congressTrades.filter(
      (t) => String(t.politician_id ?? '') === person.id
    );
    if (mine.length < 2) {
      out.push(person);
      continue;
    }
    const days = parseDaysSince(
      mine[0]?.filed_at_date ?? mine[0]?.transaction_date
    );
    out.push({
      ...person,
      metric: String(mine.length),
      metric_label: 'עסקאות',
      activity_score: mine.length,
      subtitle:
        days != null
          ? `${person.subtitle} · לפני ${days} ימים`
          : person.subtitle,
    });
  }
  return out;
}

async function enrichTopPerformers(
  people: ExplorePerson[],
  congressTrades: UwCongressTrade[]
): Promise<ExplorePerson[]> {
  const out: ExplorePerson[] = [];
  let computed = 0;
  for (const person of people) {
    if (person.kind !== 'politician' || computed >= 6) {
      out.push(person);
      continue;
    }
    const mine = congressTrades.filter(
      (t) => String(t.politician_id ?? '') === person.id
    );
    if (mine.length < 5) {
      out.push(person);
      continue;
    }
    try {
      const m = await metricsFromCongressTrades(mine, { maxTickers: 20 });
      const ret = m?.period_returns?.ALL;
      computed++;
      out.push({
        ...person,
        returns: m?.period_returns,
        sparkline_values: m?.series.slice(-24).map((p) => p.value),
        metric: ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : person.metric,
        metric_label: 'תשואה מוערכת',
      });
    } catch (e) {
      console.warn('enrichTopPerformers', person.id, e);
      out.push(person);
    }
    await delay(120);
  }
  return out;
}

function formatCompactUsd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function sanitizeExploreWarnings(warnings: string[]): string[] {
  return warnings
    .map(sanitizeExploreWarning)
    .filter((w): w is string => Boolean(w))
    .slice(0, 2);
}

function sanitizeExploreWarning(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/[<]|\bhtml\b|doctype/i.test(s)) return null;
  if (/\b500\b|\b502\b|\b503\b/.test(s) && /quiver|api\.|\/beta\//i.test(s)) return null;
  if (s.includes('429') || /rate limit/i.test(s)) {
    return 'מכסת API — מוצגים נתונים שמורים.';
  }
  if (s.length > 100) return `${s.slice(0, 97)}…`;
  return s;
}
