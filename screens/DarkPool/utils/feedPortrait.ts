import {
  congressPhotoUrl,
  extractBioguideFromCongressUrl,
  looksLikePersonPhoto,
} from './investorPlaceholder';
import { knownPortraitForInvestor } from './knownInvestorPortraits';

/**
 * אווטאר לפיד — פנים אמיתיות בלבד.
 * לא לוגו טיקר / Brandfetch / UW tickers. קונגרס: ImageURL שמור או BioGuide.
 */
export function resolveFeedPortraitUrl(opts: {
  storedUrl?: string | null;
  personKind?: 'politician' | 'insider';
  personId?: string | null;
  personName?: string | null;
}): string | null {
  const stored = opts.storedUrl?.trim() || null;
  if (stored && looksLikePersonPhoto(stored)) return stored;

  const known = knownPortraitForInvestor({
    personId: opts.personId ?? undefined,
    name: opts.personName,
  });
  if (known) return known;

  if (opts.personKind === 'politician') {
    const congress =
      congressPhotoUrl(opts.personId) ??
      congressPhotoUrl(extractBioguideFromCongressUrl(stored));
    if (congress) return congress;
  }

  return null;
}

export function applyQuiverPoliticianImages<
  T extends { politician_id: string; politician_image_url: string | null },
>(
  rows: T[],
  politicians: Array<{ BioGuideID?: string; ImageURL?: string }>
): T[] {
  if (!rows.length || !politicians.length) return rows;

  const byBg = new Map<string, string>();
  for (const p of politicians) {
    const bg = String(p.BioGuideID ?? '')
      .trim()
      .toUpperCase();
    const url = p.ImageURL?.trim();
    if (bg && url && looksLikePersonPhoto(url)) byBg.set(bg, url);
  }
  if (!byBg.size) return rows;

  return rows.map((row) => {
    const quiver = byBg.get(String(row.politician_id ?? '').trim().toUpperCase());
    if (!quiver) return row;
    const current = row.politician_image_url?.trim() || null;
    if (current && !isGuessedCongressPhoto(current) && looksLikePersonPhoto(current)) {
      return row;
    }
    if (current === quiver) return row;
    return { ...row, politician_image_url: quiver };
  });
}

function isGuessedCongressPhoto(url: string): boolean {
  return url.includes('unitedstates.github.io/images/congress');
}
