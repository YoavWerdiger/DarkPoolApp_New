/**
 * רשימה סטטית מאוצרת — רק אנשים מוכרים עם תמונות מאומתות (קונגרס / Wikimedia).
 * הגריד בגילוי מציג רק פרופילים מרשימה זו (+ מומלצים מ-DB שמופיעים ברשימה).
 */

import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';

const CONGRESS = 'https://unitedstates.github.io/images/congress/225x275';
const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

/** פרופילים מובילים — סדר תצוגה קבוע */
export const CURATED_EXPLORE_PROFILES: ExplorePerson[] = [
  // פוליטיקאים — תמונות רשמיות מ-congress.gov
  {
    // UW UUID — נשיא (executive), לא BioGuide של קונגרס; עסקאות ב־dark_pool_congress_trades
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
    id: 'S000148',
    name: 'Chuck Schumer',
    subtitle: 'Senate · דמוקרט',
    image_url: `${CONGRESS}/S000148.jpg`,
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
    id: 'R000595',
    name: 'Marco Rubio',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/R000595.jpg`,
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
    id: 'O000172',
    name: 'Alexandria Ocasio-Cortez',
    subtitle: 'בית הנציגים · דמוקרטית',
    image_url: `${CONGRESS}/O000172.jpg`,
    kind: 'politician',
    activity_score: 95,
  },
  {
    id: 'P000603',
    name: 'Rand Paul',
    subtitle: 'Senate · רפובליקני',
    image_url: `${CONGRESS}/P000603.jpg`,
    kind: 'politician',
    activity_score: 94,
  },
  {
    id: 'C001114',
    name: 'Dan Crenshaw',
    subtitle: 'בית הנציגים · רפובליקני',
    image_url: `${CONGRESS}/C001114.jpg`,
    kind: 'politician',
    activity_score: 93,
  },
  // מנכ"לים ובכירים — Wikimedia
  {
    id: 'TSLA:Musk',
    name: 'Elon Musk',
    subtitle: 'CEO · Tesla',
    image_url: `${WIKI}/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg`,
    kind: 'insider',
    ticker: 'TSLA',
    activity_score: 100,
  },
  {
    id: 'AAPL:Cook',
    name: 'Tim Cook',
    subtitle: 'CEO · Apple',
    image_url: `${WIKI}/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg`,
    kind: 'insider',
    ticker: 'AAPL',
    activity_score: 99,
  },
  {
    id: 'MSFT:Nadella',
    name: 'Satya Nadella',
    subtitle: 'CEO · Microsoft',
    image_url: `${WIKI}/0/0c/Satya_Nadella.jpg`,
    kind: 'insider',
    ticker: 'MSFT',
    activity_score: 98,
  },
  {
    id: 'NVDA:Huang',
    name: 'Jensen Huang',
    subtitle: 'CEO · NVIDIA',
    image_url: `${WIKI}/9/9e/Jensen_Huang_%28cropped%29.jpg`,
    kind: 'insider',
    ticker: 'NVDA',
    activity_score: 97,
  },
  {
    id: 'META:Zuckerberg',
    name: 'Mark Zuckerberg',
    subtitle: 'CEO · Meta',
    image_url: `${WIKI}/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg`,
    kind: 'insider',
    ticker: 'META',
    activity_score: 96,
  },
  {
    id: 'ORCL:Ellison',
    name: 'Larry Ellison',
    subtitle: 'Chairman · Oracle',
    image_url: `${WIKI}/0/00/Larry_Ellison_on_stage.jpg`,
    kind: 'insider',
    ticker: 'ORCL',
    activity_score: 95,
  },
  // מנהלי קרנות — 13F
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
    image_url: `${WIKI}/4/4a/Bill_Ackman_2019.jpg`,
    kind: 'fund_manager',
    activity_score: 98,
  },
];

const CURATED_ID_SET = new Set(CURATED_EXPLORE_PROFILES.map((p) => p.id));

export function isCuratedExploreId(personId: string): boolean {
  return CURATED_ID_SET.has(personId.trim());
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
