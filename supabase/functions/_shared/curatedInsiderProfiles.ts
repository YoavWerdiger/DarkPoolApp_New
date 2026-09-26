/**
 * מנכ"לים מאוצרים — חייב להישאר מסונכרן עם
 * screens/DarkPool/utils/curatedInsiderPins.ts + executivePortraitUrls.ts
 */

import { curatedCeoPortraitUrl } from './executivePortraitUrls.ts';

export interface CuratedInsiderPin {
  /** מזהה ניווט: TICKER:Display Name */
  personId: string;
  ticker: string;
  displayName: string;
  /** שם Form 4 / Quiver — התאמה מדויקת אחרי normalize */
  form4NameExact: string;
  /** SEC reporting-owner CIK (10 ספרות) — לא BioGuide; מקור: Form 4 / UW roster */
  insiderCik: string;
  imageUrl: string;
  altTickers?: string[];
}

function pin(
  personId: string,
  ticker: string,
  displayName: string,
  form4NameExact: string,
  insiderCik: string,
  altTickers?: string[]
): CuratedInsiderPin {
  return {
    personId,
    ticker,
    displayName,
    form4NameExact,
    insiderCik,
    imageUrl: curatedCeoPortraitUrl(personId) ?? '',
    altTickers,
  };
}

export const CURATED_INSIDER_PINS: CuratedInsiderPin[] = [
  pin('NVDA:Jensen Huang', 'NVDA', 'Jensen Huang', 'HUANG JEN HSUN', '0001197649'),
  pin('AAPL:Tim Cook', 'AAPL', 'Tim Cook', 'COOK TIMOTHY', '0001214156'),
  pin('META:Mark Zuckerberg', 'META', 'Mark Zuckerberg', 'ZUCKERBERG MARK', '0001548760'),
  pin('MSFT:Satya Nadella', 'MSFT', 'Satya Nadella', 'NADELLA SATYA', '0001513142'),
  pin('GOOGL:Sundar Pichai', 'GOOGL', 'Sundar Pichai', 'PICHAI SUNDAR', '0001534753', ['GOOG']),
  pin('TSLA:Elon Musk', 'TSLA', 'Elon Musk', 'MUSK ELON', '0001494730'),
  pin('JPM:Jamie Dimon', 'JPM', 'Jamie Dimon', 'DIMON JAMES', '0001195345'),
  pin('AMD:Lisa Su', 'AMD', 'Lisa Su', 'SU LISA', '0001405109'),
  pin('AMZN:Andy Jassy', 'AMZN', 'Andy Jassy', 'JASSY ANDREW', '0001374545'),
  pin('PLTR:Alex Karp', 'PLTR', 'Alex Karp', 'KARP ALEXANDER', '0001823951'),
];

export function normalizeInsiderMatchName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCuratedInsiderByPersonId(
  personId: string
): CuratedInsiderPin | null {
  const id = personId.trim();
  return CURATED_INSIDER_PINS.find((p) => p.personId === id) ?? null;
}

export function tickersForCuratedInsider(pin: CuratedInsiderPin): string[] {
  const set = new Set<string>([pin.ticker.toUpperCase()]);
  for (const t of pin.altTickers ?? []) set.add(t.toUpperCase());
  return Array.from(set);
}

export function insiderNameMatchesPin(
  pin: CuratedInsiderPin,
  rawName: string | null | undefined
): boolean {
  const dbName = normalizeInsiderMatchName(String(rawName ?? ''));
  const exact = normalizeInsiderMatchName(pin.form4NameExact);
  if (!dbName || !exact) return false;
  if (dbName === exact) return true;
  const dbParts = dbName.split(' ').filter(Boolean);
  const pinParts = exact.split(' ').filter(Boolean);
  if (dbParts.length >= 2 && pinParts.length >= 2) {
    const dbLast = dbParts[0];
    const pinLast = pinParts[0];
    if (dbLast === pinLast) {
      const dbGiven = new Set(dbParts.slice(1));
      const pinGiven = new Set(pinParts.slice(1));
      for (const g of pinGiven) {
        if (dbGiven.has(g)) return true;
      }
    }
  }
  return false;
}

export function curatedInsiderMatchesRow(
  pin: CuratedInsiderPin,
  row: { insider_name?: string | null; ticker?: string | null }
): boolean {
  const sym = String(row.ticker ?? '').toUpperCase();
  if (!tickersForCuratedInsider(pin).includes(sym)) return false;
  return insiderNameMatchesPin(pin, row.insider_name);
}
