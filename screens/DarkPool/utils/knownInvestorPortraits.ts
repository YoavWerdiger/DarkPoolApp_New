/**
 * תמונות ציבוריות ידועות — fallback כש-DB לא מחזיר logo.
 * Wikimedia / congress (יציב יחסית לגילוי).
 */

import { Image } from 'react-native';
import { CURATED_CEO_PORTRAIT_BY_PERSON_ID } from './executivePortraitUrls';

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';
const CONGRESS = 'https://unitedstates.github.io/images/congress/225x275';

const PORTRAIT_MODULES = {
  ackman: require('../../../assets/portraits/bill-ackman.jpg'),
  buffett: require('../../../assets/portraits/warren-buffett.jpg'),
  pelosi: require('../../../assets/portraits/nancy-pelosi.jpg'),
  musk: require('../../../assets/portraits/elon-musk.jpg'),
  huang: require('../../../assets/portraits/jensen-huang.jpg'),
} as const;

type LocalPortraitKey = keyof typeof PORTRAIT_MODULES;

const resolvedLocalUris = new Map<LocalPortraitKey, string | null>();

function localUri(key: LocalPortraitKey): string | null {
  if (resolvedLocalUris.has(key)) return resolvedLocalUris.get(key) ?? null;
  const uri = Image.resolveAssetSource?.(PORTRAIT_MODULES[key])?.uri ?? null;
  resolvedLocalUris.set(key, uri);
  return uri;
}

/** דיוקנאות מקומיים — גוברים על DB / Wikimedia / congress בכל המסכים. */
const LOCAL_PORTRAIT_BY_ID: Record<string, LocalPortraitKey> = {
  '1336528': 'ackman',
  '1067983': 'buffett',
  P000197: 'pelosi',
  'TSLA:Elon Musk': 'musk',
  'NVDA:Jensen Huang': 'huang',
};

const LOCAL_PORTRAIT_BY_NAME: Record<string, LocalPortraitKey> = {
  'bill ackman': 'ackman',
  'william ackman': 'ackman',
  'william a. ackman': 'ackman',
  'ackman william': 'ackman',
  'warren buffett': 'buffett',
  'warren e. buffett': 'buffett',
  'buffett warren e': 'buffett',
  'nancy pelosi': 'pelosi',
  'elon musk': 'musk',
  'musk elon': 'musk',
  'jensen huang': 'huang',
  'jen-hsun huang': 'huang',
  'huang jen hsun': 'huang',
};

export function localPortraitForInvestor(opts: {
  personId?: string | null;
  name?: string | null;
}): string | null {
  const id = opts.personId?.trim();
  if (id && LOCAL_PORTRAIT_BY_ID[id]) return localUri(LOCAL_PORTRAIT_BY_ID[id]);
  const nameKey = opts.name?.trim().toLowerCase().replace(/\s+/g, ' ');
  if (nameKey && LOCAL_PORTRAIT_BY_NAME[nameKey]) {
    return localUri(LOCAL_PORTRAIT_BY_NAME[nameKey]);
  }
  return null;
}

export const KNOWN_INVESTOR_PORTRAIT_BY_ID: Record<string, string> = {
  ...CURATED_CEO_PORTRAIT_BY_PERSON_ID,
  P000197: `${CONGRESS}/P000197.jpg`,
  C001114: `${CONGRESS}/C001114.jpg`,
  M000355: `${CONGRESS}/M000355.jpg`,
  G000583: `${CONGRESS}/G000583.jpg`,
  C001098: `${CONGRESS}/C001098.jpg`,
  M001218: `${CONGRESS}/M001218.jpg`,
  B001236: `${CONGRESS}/B001236.jpg`,
  M001217: `${CONGRESS}/M001217.jpg`,
  S000168: `${CONGRESS}/S000168.jpg`,
  T000278: `${CONGRESS}/T000278.jpg`,
  G000596: `${CONGRESS}/G000596.jpg`,
  K000389: `${CONGRESS}/K000389.jpg`,
  M001157: `${CONGRESS}/M001157.jpg`,
  W000802: `${CONGRESS}/W000802.jpg`,
  D000032: `${CONGRESS}/D000032.jpg`,
  M001190: `${CONGRESS}/M001190.jpg`,
  '888dc73f-f1eb-485a-a241-80657aaaaff9': `${WIKI}/5/56/Donald_Trump_official_portrait.jpg`,
  '1067983': `${WIKI}/5/51/Warren_Buffett_KU_Visit.jpg`,
  '1697748': `${WIKI}/4/44/Cathie_Wood_ARK_Invest_Photo.jpg`,
  '1336528': `${WIKI}/d/d8/Bill_Ackman_%2826410186110%29_%28cropped%29.jpg`,
};

export const KNOWN_INVESTOR_PORTRAIT_BY_NAME: Record<string, string> = {
  'warren buffett': KNOWN_INVESTOR_PORTRAIT_BY_ID['1067983'],
  'cathie wood': KNOWN_INVESTOR_PORTRAIT_BY_ID['1697748'],
  'bill ackman': KNOWN_INVESTOR_PORTRAIT_BY_ID['1336528'],
  'nancy pelosi': KNOWN_INVESTOR_PORTRAIT_BY_ID.P000197,
  'john curtis': KNOWN_INVESTOR_PORTRAIT_BY_ID.C001114,
  'mitch mcconnell': KNOWN_INVESTOR_PORTRAIT_BY_ID.M000355,
  'josh gottheimer': KNOWN_INVESTOR_PORTRAIT_BY_ID.G000583,
  'ted cruz': KNOWN_INVESTOR_PORTRAIT_BY_ID.C001098,
  'rich mccormick': KNOWN_INVESTOR_PORTRAIT_BY_ID.M001218,
  'john boozman': KNOWN_INVESTOR_PORTRAIT_BY_ID.B001236,
  'jared moskowitz': KNOWN_INVESTOR_PORTRAIT_BY_ID.M001217,
  'maria elvira salazar': KNOWN_INVESTOR_PORTRAIT_BY_ID.S000168,
  'tommy tuberville': KNOWN_INVESTOR_PORTRAIT_BY_ID.T000278,
  'marjorie taylor greene': KNOWN_INVESTOR_PORTRAIT_BY_ID.G000596,
  'ro khanna': KNOWN_INVESTOR_PORTRAIT_BY_ID.K000389,
  'michael mccaul': KNOWN_INVESTOR_PORTRAIT_BY_ID.M001157,
  'michael t. mccaul': KNOWN_INVESTOR_PORTRAIT_BY_ID.M001157,
  'sheldon whitehouse': KNOWN_INVESTOR_PORTRAIT_BY_ID.W000802,
  'byron donalds': KNOWN_INVESTOR_PORTRAIT_BY_ID.D000032,
  'markwayne mullin': KNOWN_INVESTOR_PORTRAIT_BY_ID.M001190,
  'donald trump': KNOWN_INVESTOR_PORTRAIT_BY_ID['888dc73f-f1eb-485a-a241-80657aaaaff9'],
  'donald j trump': KNOWN_INVESTOR_PORTRAIT_BY_ID['888dc73f-f1eb-485a-a241-80657aaaaff9'],
  'jensen huang': KNOWN_INVESTOR_PORTRAIT_BY_ID['NVDA:Jensen Huang'],
  'tim cook': KNOWN_INVESTOR_PORTRAIT_BY_ID['AAPL:Tim Cook'],
  'mark zuckerberg': KNOWN_INVESTOR_PORTRAIT_BY_ID['META:Mark Zuckerberg'],
  'satya nadella': KNOWN_INVESTOR_PORTRAIT_BY_ID['MSFT:Satya Nadella'],
  'sundar pichai': KNOWN_INVESTOR_PORTRAIT_BY_ID['GOOGL:Sundar Pichai'],
  'elon musk': KNOWN_INVESTOR_PORTRAIT_BY_ID['TSLA:Elon Musk'],
  'jamie dimon': KNOWN_INVESTOR_PORTRAIT_BY_ID['JPM:Jamie Dimon'],
  'lisa su': KNOWN_INVESTOR_PORTRAIT_BY_ID['AMD:Lisa Su'],
  'andy jassy': KNOWN_INVESTOR_PORTRAIT_BY_ID['AMZN:Andy Jassy'],
  'alex karp': KNOWN_INVESTOR_PORTRAIT_BY_ID['PLTR:Alex Karp'],
};

/** person_id → URL */
export function knownPortraitForInvestor(opts: {
  personId?: string | null;
  name?: string | null;
}): string | null {
  const local = localPortraitForInvestor(opts);
  if (local) return local;

  const id = opts.personId?.trim();
  if (id && KNOWN_INVESTOR_PORTRAIT_BY_ID[id]) {
    return KNOWN_INVESTOR_PORTRAIT_BY_ID[id];
  }

  const nameKey = opts.name?.trim().toLowerCase();
  if (nameKey && KNOWN_INVESTOR_PORTRAIT_BY_NAME[nameKey]) {
    return KNOWN_INVESTOR_PORTRAIT_BY_NAME[nameKey];
  }

  if (id && nameKey) {
    if (nameKey.includes('ackman') || id === '1336528') {
      return KNOWN_INVESTOR_PORTRAIT_BY_NAME['bill ackman'];
    }
  }

  return null;
}

/** כל ה-URLs הסטטיים — ל-prefetch מקבילי ב-warm / first paint */
export function allKnownPortraitUrls(): string[] {
  return Array.from(new Set(Object.values(KNOWN_INVESTOR_PORTRAIT_BY_ID)));
}
