/**
 * Pins ל-Form 4 — mirror של supabase/functions/_shared/curatedInsiderProfiles.ts
 */

import { CURATED_CEO_PORTRAIT_BY_PERSON_ID, curatedCeoPortraitUrl } from './executivePortraitUrls';

export interface CuratedInsiderPin {
  personId: string;
  ticker: string;
  displayName: string;
  form4NameExact: string;
  imageUrl: string;
  altTickers?: string[];
}

function pin(
  personId: string,
  ticker: string,
  displayName: string,
  form4NameExact: string,
  altTickers?: string[]
): CuratedInsiderPin {
  return {
    personId,
    ticker,
    displayName,
    form4NameExact,
    imageUrl: curatedCeoPortraitUrl(personId) ?? CURATED_CEO_PORTRAIT_BY_PERSON_ID[personId] ?? '',
    altTickers,
  };
}

export const CURATED_INSIDER_PINS: CuratedInsiderPin[] = [
  pin('NVDA:Jensen Huang', 'NVDA', 'Jensen Huang', 'HUANG JEN HSUN'),
  pin('AAPL:Tim Cook', 'AAPL', 'Tim Cook', 'COOK TIMOTHY'),
  pin('META:Mark Zuckerberg', 'META', 'Mark Zuckerberg', 'ZUCKERBERG MARK'),
  pin('MSFT:Satya Nadella', 'MSFT', 'Satya Nadella', 'NADELLA SATYA'),
  pin('GOOGL:Sundar Pichai', 'GOOGL', 'Sundar Pichai', 'PICHAI SUNDAR', ['GOOG']),
  pin('TSLA:Elon Musk', 'TSLA', 'Elon Musk', 'MUSK ELON'),
  pin('JPM:Jamie Dimon', 'JPM', 'Jamie Dimon', 'DIMON JAMES'),
  pin('AMD:Lisa Su', 'AMD', 'Lisa Su', 'SU LISA'),
  pin('AMZN:Andy Jassy', 'AMZN', 'Andy Jassy', 'JASSY ANDREW'),
  pin('PLTR:Alex Karp', 'PLTR', 'Alex Karp', 'KARP ALEXANDER'),
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
  return CURATED_INSIDER_PINS.find((p) => p.personId === personId.trim()) ?? null;
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
  if (dbParts.length >= 2 && pinParts.length >= 2 && dbParts[0] === pinParts[0]) {
    const dbGiven = new Set(dbParts.slice(1));
    for (const g of pinParts.slice(1)) {
      if (dbGiven.has(g)) return true;
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
