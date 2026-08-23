/**
 * תמונות ציבוריות ידועות — fallback כש-UW/DB לא מחזירים logo.
 * Wikimedia / congress (יציב יחסית לגילוי).
 */

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

export const KNOWN_INVESTOR_PORTRAIT_BY_ID: Record<string, string> = {
  P000197: 'https://unitedstates.github.io/images/congress/225x275/P000197.jpg',
  S000148: 'https://unitedstates.github.io/images/congress/225x275/S000148.jpg',
  M000355: 'https://unitedstates.github.io/images/congress/225x275/M000355.jpg',
  R000595: 'https://unitedstates.github.io/images/congress/225x275/R000595.jpg',
  C001098: 'https://unitedstates.github.io/images/congress/225x275/C001098.jpg',
  O000172: 'https://unitedstates.github.io/images/congress/225x275/O000172.jpg',
  P000603: 'https://unitedstates.github.io/images/congress/225x275/P000603.jpg',
  C001114: 'https://unitedstates.github.io/images/congress/225x275/C001114.jpg',
  '888dc73f-f1eb-485a-a241-80657aaaaff9': `${WIKI}/5/56/Donald_Trump_official_portrait.jpg`,
  '1067983': `${WIKI}/5/51/Warren_Buffett_KU_Visit.jpg`,
  '1697748': `${WIKI}/4/44/Cathie_Wood_ARK_Invest_Photo.jpg`,
  '1336528': `${WIKI}/4/4a/Bill_Ackman_2019.jpg`,
  'AAPL:Cook': `${WIKI}/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg`,
};

export const KNOWN_INVESTOR_PORTRAIT_BY_NAME: Record<string, string> = {
  'elon musk': `${WIKI}/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg`,
  'tim cook': KNOWN_INVESTOR_PORTRAIT_BY_ID['AAPL:Cook'],
  'cook tim': KNOWN_INVESTOR_PORTRAIT_BY_ID['AAPL:Cook'],
  'satya nadella': `${WIKI}/0/0c/Satya_Nadella.jpg`,
  'jensen huang': `${WIKI}/9/9e/Jensen_Huang_%28cropped%29.jpg`,
  'mark zuckerberg': `${WIKI}/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg`,
  'larry ellison': `${WIKI}/0/00/Larry_Ellison_on_stage.jpg`,
  'warren buffett': KNOWN_INVESTOR_PORTRAIT_BY_ID['1067983'],
  'cathie wood': KNOWN_INVESTOR_PORTRAIT_BY_ID['1697748'],
  'bill ackman': KNOWN_INVESTOR_PORTRAIT_BY_ID['1336528'],
  'nancy pelosi': KNOWN_INVESTOR_PORTRAIT_BY_ID.P000197,
  'chuck schumer': KNOWN_INVESTOR_PORTRAIT_BY_ID.S000148,
  'mitch mcconnell': KNOWN_INVESTOR_PORTRAIT_BY_ID.M000355,
  'donald trump': KNOWN_INVESTOR_PORTRAIT_BY_ID['888dc73f-f1eb-485a-a241-80657aaaaff9'],
  'donald j trump': KNOWN_INVESTOR_PORTRAIT_BY_ID['888dc73f-f1eb-485a-a241-80657aaaaff9'],
};

/** person_id → URL (כולל insider keys מ-UW) */
export function knownPortraitForInvestor(opts: {
  personId?: string | null;
  name?: string | null;
}): string | null {
  const id = opts.personId?.trim();
  if (id && KNOWN_INVESTOR_PORTRAIT_BY_ID[id]) {
    return KNOWN_INVESTOR_PORTRAIT_BY_ID[id];
  }

  const nameKey = opts.name?.trim().toLowerCase();
  if (nameKey && KNOWN_INVESTOR_PORTRAIT_BY_NAME[nameKey]) {
    return KNOWN_INVESTOR_PORTRAIT_BY_NAME[nameKey];
  }

  if (id && nameKey) {
    const idUpper = id.toUpperCase();
    if (idUpper.includes('MUSK') || nameKey.includes('musk')) {
      return KNOWN_INVESTOR_PORTRAIT_BY_NAME['elon musk'];
    }
    if (idUpper.includes('COOK') || nameKey.includes('cook')) {
      return KNOWN_INVESTOR_PORTRAIT_BY_NAME['tim cook'];
    }
  }

  return null;
}
