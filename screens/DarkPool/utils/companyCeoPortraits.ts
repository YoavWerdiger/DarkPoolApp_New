/**
 * תמונת המנכ״ל לחברות ציבוריות שמגישות 13F (במקום לוגו הטיקר בכרטיס ובפרופיל).
 * המנכ״ל הנוכחי — מ-key_people בתיבת המידע של ויקיפדיה; התמונה — Wikimedia Commons בלבד (רישיון חופשי),
 * נבדקה ב-HEAD (200). נבדק 2026-10-29. חברה בלי תמונה חופשית (BABA, NTES, REGN, TM, MRK) — נשאר הלוגו.
 */
export const COMPANY_CEO_PORTRAITS: Record<string, { ceo: string; url: string }> = {
  AMD: { ceo: "Lisa Su", url: 'https://upload.wikimedia.org/wikipedia/commons/d/de/SXSW-2024-alih-OB7A0861-Lisa_Su_%28cropped_2%29.jpg' },
  GOOGL: { ceo: "Sundar Pichai", url: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Sundar_Pichai_-_2023_%28cropped%29.jpg' },
  AMZN: { ceo: "Andy Jassy", url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Andy_Jassy.jpg' },
  CSCO: { ceo: "Chuck Robbins", url: 'https://upload.wikimedia.org/wikipedia/commons/5/59/Charles_H._Robbins.jpg' },
  GE: { ceo: "H. Lawrence Culp Jr.", url: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Larry_Culp_in_Beijing%2C_2026.jpg' },
  GILD: { ceo: "Daniel O'Day", url: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Daniel_O%27Day.jpg' },
  INTC: { ceo: "Lip-Bu Tan", url: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Howard_Lutnick_with_Intel_CEO_Lip-Bu_Tan_%282025%29_%28cropped3%29.jpg' },
  JNJ: { ceo: "Joaquin Duato", url: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/JnJ_Duato_cropped.jpg' },
  NVDA: { ceo: "Jensen Huang", url: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Jensen_Huang_Stanford_2026-04-30_010_%28cropped%29.jpg' },
  PFE: { ceo: "Albert Bourla", url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Albert_Bourla_in_2026.png' },
  SNY: { ceo: "Belén Garijo", url: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Bel%C3%A9n_Garijo.png' },
  SFTBY: { ceo: "Masayoshi Son", url: 'https://upload.wikimedia.org/wikipedia/commons/5/58/Masayoshi_Son_%28P066533-522034%2C_cropped%29.jpg' },
  UBER: { ceo: "Dara Khosrowshahi", url: 'https://upload.wikimedia.org/wikipedia/commons/1/15/CEO_of_Uber_Technologies_Dara_Khosrowshahi_in_New_York_-_2019_%28cropped%29.jpg' },
  WMT: { ceo: "John Furner", url: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/John_Furner_headshot_2019.jpg' },
};

export function companyCeoPortraitUrl(ticker: string | null | undefined): string | null {
  const t = ticker?.trim().toUpperCase();
  return t ? COMPANY_CEO_PORTRAITS[t]?.url ?? null : null;
}
