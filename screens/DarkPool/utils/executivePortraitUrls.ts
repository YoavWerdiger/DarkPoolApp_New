/**
 * תמונות מנכ"לים מאוצרים — URLs פעילים מ-Wikimedia (נבדק מול Wikipedia REST / HEAD).
 * Mirror: supabase/functions/_shared/curatedInsiderProfiles.ts
 */

const WIKI = 'https://upload.wikimedia.org/wikipedia/commons';

/** person_id (TICKER:Display Name) → full commons URL */
export const CURATED_CEO_PORTRAIT_BY_PERSON_ID: Record<string, string> = {
  'NVDA:Jensen Huang': `${WIKI}/c/c4/Jensen_Huang_%28cropped%29.jpg`,
  'AAPL:Tim Cook': `${WIKI}/f/f7/Tim_Cook_March_2026_%28cropped_2%29.jpg`,
  'META:Mark Zuckerberg': `${WIKI}/1/18/Mark_Zuckerberg_F8_2019_Keynote_%2832830578717%29_%28cropped%29.jpg`,
  'MSFT:Satya Nadella': `${WIKI}/4/4a/Satya_Nadella_%28cropped%29.jpg`,
  'GOOGL:Sundar Pichai': `${WIKI}/c/c3/Sundar_Pichai_-_2023_%28cropped%29.jpg`,
  'TSLA:Elon Musk': `${WIKI}/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg`,
  'JPM:Jamie Dimon': `${WIKI}/0/00/Chancellor_Rachel_Reeves_meets_Jamie_Dimon_%2854838700663%29_%28cropped%29_%28cropped%29.jpg`,
  'AMD:Lisa Su': `${WIKI}/d/de/SXSW-2024-alih-OB7A0861-Lisa_Su_%28cropped_2%29.jpg`,
  'AMZN:Andy Jassy': `${WIKI}/0/07/Andy_Jassy.jpg`,
  'PLTR:Alex Karp': `${WIKI}/5/50/Alex_Karp_attends_AI_Summit_%2853302457013%29_4-5_ratio.jpg`,
};

export function curatedCeoPortraitUrl(personId: string | null | undefined): string | null {
  const id = personId?.trim();
  if (!id) return null;
  return CURATED_CEO_PORTRAIT_BY_PERSON_ID[id] ?? null;
}
