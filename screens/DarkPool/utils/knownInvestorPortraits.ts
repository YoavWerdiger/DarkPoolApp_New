/**
 * תמונות ציבוריות ידועות — fallback כש-UW/DB לא מחזירים logo.
 * Wikimedia / congress (יציב יחסית לגילוי).
 */

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

export const KNOWN_INVESTOR_PORTRAIT_BY_ID: Record<string, string> = {
  P000197: 'https://unitedstates.github.io/images/congress/225x275/P000197.jpg',
  '1067983': `${WIKI}/5/51/Warren_Buffett_KU_Visit.jpg`,
  '1697748': `${WIKI}/7/7e/Cathie_Wood_%28cropped%29.jpg`,
  '1336528': `${WIKI}/4/4a/Bill_Ackman_2019.jpg`,
};

export const KNOWN_INVESTOR_PORTRAIT_BY_NAME: Record<string, string> = {
  'elon musk': `${WIKI}/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg`,
  'tim cook': `${WIKI}/2/23/Tim_Cook_2009_cropped.jpg`,
  'warren buffett': KNOWN_INVESTOR_PORTRAIT_BY_ID['1067983'],
  'cathie wood': KNOWN_INVESTOR_PORTRAIT_BY_ID['1697748'],
  'bill ackman': KNOWN_INVESTOR_PORTRAIT_BY_ID['1336528'],
  'nancy pelosi': KNOWN_INVESTOR_PORTRAIT_BY_ID.P000197,
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
