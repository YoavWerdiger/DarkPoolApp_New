import { Image as ExpoImage } from 'expo-image';
import { brandfetchTickerLogoUri } from './brandfetch';

/**
 * Prefetch Brandfetch ticker logos for feed rows.
 * Own module so Metro always resolves a real named export (avoids stale brandfetch bundle).
 */
export function prefetchTickerLogos(symbols: Iterable<string>, max = 40): void {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const raw of symbols) {
    const uri = brandfetchTickerLogoUri(raw);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    urls.push(uri);
    if (urls.length >= max) break;
  }
  if (urls.length) {
    void ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
  }
}
