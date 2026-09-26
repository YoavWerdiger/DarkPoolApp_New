/**
 * ═══════════════════════════════════════════════════════════════════════════
 * מקור אמת יחיד — רשימת אנשים מאוצרת (Dark Pool People / Explore / Profiles)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * מודל המוצר:
 *   • אנשים / פרופילים: רק הרשימה הסטטית הזו → כרטיסי Explore, פס Home,
 *     טיפול פרופיל עמוק, דיוקנאות, materialize תיק מתוזמן, deep history.
 *   • פיד עסקאות: endpoints גלובליים (Quiver/Form4/EDGAR) — כל העסקאות,
 *     לא מסונן לרשימה המאוצרת. לחיצה על אדם בפיד עדיין פותחת פרופיל.
 *
 * אל תבלבלו בין "מי מוצג כאנשים" לבין "אילו עסקאות מופיעות בפיד".
 *
 * מקבילים ב-edge (חייבים להישאר מסונכרנים ידנית עם ה-ids כאן):
 *   • supabase/functions/_shared/darkpoolPortfolioSnapshots.ts → CURATED_MATERIALIZE_TARGETS
 *   • supabase/functions/_shared/quiverQuant.ts → CURATED_CONGRESS_BIOGUIDES + CURATED_EXECUTIVE_UW_IDS
 *
 * תמונות: congress (BioGuide) או Wikimedia מלא. תצוגה דרך portraitDisplayUrl
 * (snap לרוחבי thumb חוקיים של Wikimedia — אחרת 400).
 */

import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import { curatedCeoPortraitUrl } from './executivePortraitUrls';

const CONGRESS = 'https://unitedstates.github.io/images/congress/225x275';
const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

/** פרופילים מובילים — סדר תצוגה קבוע (activity_score יורד) */
export const CURATED_EXPLORE_PROFILES: ExplorePerson[] = [
  // ── פוליטיקאים / executive — Quiver BioGuide או trumpstocktrades ──
  {
    // מזהה פנימי (executive) — עסקאות Quiver trumpstocktrades
    id: '888dc73f-f1eb-485a-a241-80657aaaaff9',
    name: 'Donald Trump',
    subtitle: 'נשיא · רפובליקני',
    image_url: `${WIKI}/5/56/Donald_Trump_official_portrait.jpg`,
    kind: 'politician',
    activity_score: 101,
  },
  {
    id: 'P000197',
    name: 'Nancy Pelosi',
    subtitle: 'בית הנציגים · דמוקרטית',
    image_url: `${CONGRESS}/P000197.jpg`,
    kind: 'politician',
    activity_score: 100,
  },
  {
    id: 'C001114',
    name: 'John Curtis',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/C001114.jpg`,
    kind: 'politician',
    activity_score: 99,
  },
  {
    id: 'M000355',
    name: 'Mitch McConnell',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/M000355.jpg`,
    kind: 'politician',
    activity_score: 98,
  },
  {
    id: 'G000583',
    name: 'Josh Gottheimer',
    subtitle: 'בית הנציגים · דמוקרט',
    image_url: `${CONGRESS}/G000583.jpg`,
    kind: 'politician',
    activity_score: 97,
  },
  {
    id: 'C001098',
    name: 'Ted Cruz',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/C001098.jpg`,
    kind: 'politician',
    activity_score: 96,
  },
  {
    id: 'M001218',
    name: 'Rich McCormick',
    subtitle: 'בית הנציגים · רפובליקני',
    image_url: `${CONGRESS}/M001218.jpg`,
    kind: 'politician',
    activity_score: 95,
  },
  {
    id: 'B001236',
    name: 'John Boozman',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/B001236.jpg`,
    kind: 'politician',
    activity_score: 94,
  },
  {
    id: 'M001217',
    name: 'Jared Moskowitz',
    subtitle: 'בית הנציגים · דמוקרט',
    image_url: `${CONGRESS}/M001217.jpg`,
    kind: 'politician',
    activity_score: 93,
  },
  {
    id: 'S000168',
    name: 'Maria Elvira Salazar',
    subtitle: 'בית הנציגים · רפובליקנית',
    image_url: `${CONGRESS}/S000168.jpg`,
    kind: 'politician',
    activity_score: 92,
  },
  {
    id: 'T000278',
    name: 'Tommy Tuberville',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/T000278.jpg`,
    kind: 'politician',
    activity_score: 91,
  },
  {
    id: 'G000596',
    name: 'Marjorie Taylor Greene',
    subtitle: 'בית הנציגים · רפובליקנית',
    image_url: `${CONGRESS}/G000596.jpg`,
    kind: 'politician',
    activity_score: 90,
  },
  {
    id: 'W000802',
    name: 'Sheldon Whitehouse',
    subtitle: 'Senate · דמוקרט',
    image_url: `${CONGRESS}/W000802.jpg`,
    kind: 'politician',
    activity_score: 87,
  },
  {
    id: 'D000032',
    name: 'Byron Donalds',
    subtitle: 'בית הנציגים · רפובליקני',
    image_url: `${CONGRESS}/D000032.jpg`,
    kind: 'politician',
    activity_score: 86,
  },
  {
    id: 'M001190',
    name: 'Markwayne Mullin',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/M001190.jpg`,
    kind: 'politician',
    activity_score: 85,
  },
  // ── מנהלי קרנות — 13F (snapshot; רענון via sync-fund-13f / sec-api) ──
  {
    id: '1067983',
    name: 'Warren Buffett',
    subtitle: 'Berkshire Hathaway',
    image_url: `${WIKI}/5/51/Warren_Buffett_KU_Visit.jpg`,
    kind: 'fund_manager',
    activity_score: 100,
  },
  {
    id: '1697748',
    name: 'Cathie Wood',
    subtitle: 'ARK Invest',
    image_url: `${WIKI}/4/44/Cathie_Wood_ARK_Invest_Photo.jpg`,
    kind: 'fund_manager',
    activity_score: 99,
  },
  {
    id: '1336528',
    name: 'Bill Ackman',
    subtitle: 'Pershing Square',
    image_url: `${WIKI}/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg`,
    kind: 'fund_manager',
    activity_score: 98,
  },
];

function ceoExplore(
  id: string,
  name: string,
  subtitle: string,
  ticker: string,
  activity_score: number
): ExplorePerson {
  return {
    id,
    name,
    subtitle,
    image_url: curatedCeoPortraitUrl(id) ?? undefined,
    kind: 'insider',
    ticker,
    activity_score,
  };
}

/** מנכ"לים / בכירים — Form 4; person_id כמו בפיד (TICKER:שם תצוגה). */
export const CURATED_INSIDER_PROFILES: ExplorePerson[] = [
  ceoExplore('NVDA:Jensen Huang', 'Jensen Huang', 'CEO · NVIDIA', 'NVDA', 100),
  ceoExplore('AAPL:Tim Cook', 'Tim Cook', 'CEO · Apple', 'AAPL', 99),
  ceoExplore('META:Mark Zuckerberg', 'Mark Zuckerberg', 'CEO · Meta', 'META', 98),
  ceoExplore('MSFT:Satya Nadella', 'Satya Nadella', 'CEO · Microsoft', 'MSFT', 97),
  ceoExplore('GOOGL:Sundar Pichai', 'Sundar Pichai', 'CEO · Alphabet', 'GOOGL', 96),
  ceoExplore('TSLA:Elon Musk', 'Elon Musk', 'CEO · Tesla', 'TSLA', 95),
  ceoExplore('JPM:Jamie Dimon', 'Jamie Dimon', 'CEO · JPMorgan', 'JPM', 94),
  ceoExplore('AMD:Lisa Su', 'Lisa Su', 'CEO · AMD', 'AMD', 93),
  ceoExplore('AMZN:Andy Jassy', 'Andy Jassy', 'CEO · Amazon', 'AMZN', 92),
  ceoExplore('PLTR:Alex Karp', 'Alex Karp', 'CEO · Palantir', 'PLTR', 91),
];

/** רשימה מאוחדת לגילוי / חיפוש / People. */
export const ALL_CURATED_EXPLORE_PROFILES: ExplorePerson[] = [
  ...CURATED_EXPLORE_PROFILES,
  ...CURATED_INSIDER_PROFILES,
];

const CURATED_ID_SET = new Set(ALL_CURATED_EXPLORE_PROFILES.map((p) => p.id));

export function isCuratedExploreId(personId: string): boolean {
  return CURATED_ID_SET.has(personId.trim());
}

export function filterCuratedExplorePeople(people: ExplorePerson[]): ExplorePerson[] {
  return people.filter((p) => isCuratedExploreId(p.id));
}

export function listCuratedInsiderExplorePeople(): ExplorePerson[] {
  return CURATED_INSIDER_PROFILES.map((p) => ({ ...p }));
}

/** תמונה מותרת — רק מקורות מאומתים, לא Wikipedia אקראי */
export function isTrustedPortraitUrl(url: string | null | undefined): boolean {
  const u = url?.trim().toLowerCase() ?? '';
  if (!u) return false;
  return (
    u.includes('unitedstates.github.io/images/congress') ||
    u.includes('upload.wikimedia.org/wikipedia/commons') ||
    u.includes('bioguide.congress.gov')
  );
}
