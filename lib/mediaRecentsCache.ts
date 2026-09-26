import { InteractionManager } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';

/** עמוד ראשון קטן — מספיק לגריד, בלי לחכות לכל האלבום. */
export const MEDIA_RECENTS_PAGE_SIZE = 30;

export type MediaRecentsKind = 'all' | 'photo' | 'video';

export type MediaRecentAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: 'photo' | 'video';
  width: number;
  height: number;
  duration: number;
  creationTime: number;
};

export type MediaRecentsPage = {
  assets: MediaRecentAsset[];
  endCursor: string | null;
  hasNextPage: boolean;
  fetchedAt: number;
};

export type PickedRecentMedia = {
  id: string;
  uri: string;
  thumbnailUri: string;
  type: 'image' | 'video';
  name: string;
  width?: number;
  height?: number;
  duration?: number;
};

const memory = new Map<string, MediaRecentsPage>();
const STALE_MS = 30_000;
let prefetchInFlight: Promise<MediaRecentsPage | null> | null = null;

export function mediaRecentsCacheKey(kind: MediaRecentsKind): string {
  return `media-recents:${kind}:p${MEDIA_RECENTS_PAGE_SIZE}`;
}

export function peekMediaRecents(kind: MediaRecentsKind): MediaRecentsPage | null {
  return memory.get(mediaRecentsCacheKey(kind)) ?? null;
}

export function writeMediaRecents(kind: MediaRecentsKind, page: MediaRecentsPage): MediaRecentsPage {
  const stored: MediaRecentsPage = {
    ...page,
    assets: page.assets.slice(0, MEDIA_RECENTS_PAGE_SIZE),
  };
  memory.set(mediaRecentsCacheKey(kind), stored);
  return stored;
}

export function clearMediaRecentsCache(): void {
  memory.clear();
  prefetchInFlight = null;
}

export function filterRecentsByKind(
  assets: MediaRecentAsset[],
  kind: MediaRecentsKind,
): MediaRecentAsset[] {
  if (kind === 'all') return assets;
  return assets.filter((asset) => asset.mediaType === kind);
}

export function isMediaLibraryReadable(
  perm: { granted?: boolean; accessPrivileges?: string | null } | null | undefined,
): boolean {
  if (!perm) return false;
  if (perm.granted) return true;
  return perm.accessPrivileges === 'limited';
}

function mapAsset(asset: MediaLibrary.Asset): MediaRecentAsset | null {
  const mediaType = asset.mediaType === 'video' ? 'video' : asset.mediaType === 'photo' ? 'photo' : null;
  if (!mediaType || !asset.id || !asset.uri) return null;
  return {
    id: asset.id,
    uri: asset.uri,
    filename: asset.filename || (mediaType === 'video' ? 'video.mp4' : 'image.jpg'),
    mediaType,
    width: asset.width || 0,
    height: asset.height || 0,
    duration: asset.duration || 0,
    creationTime: asset.creationTime || 0,
  };
}

function mediaTypesFor(kind: MediaRecentsKind): MediaLibrary.MediaTypeValue[] {
  if (kind === 'photo') return [MediaLibrary.MediaType.photo];
  if (kind === 'video') return [MediaLibrary.MediaType.video];
  return [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
}

function warmThumbCache(assets: MediaRecentAsset[]): void {
  const uris = assets.slice(0, 16).map((asset) => asset.uri).filter(Boolean);
  if (uris.length === 0) return;
  void Promise.resolve()
    .then(() => ExpoImage.prefetch(uris, { cachePolicy: 'memory-disk' }))
    .catch(() => {
      /* thumbs יטענו ב-grid */
    });
}

export async function getMediaLibraryReadStatus(): Promise<{
  readable: boolean;
  canAskAgain: boolean;
  status: string;
}> {
  try {
    const perm = await MediaLibrary.getPermissionsAsync();
    return {
      readable: isMediaLibraryReadable(perm),
      canAskAgain: perm.canAskAgain !== false,
      status: perm.status,
    };
  } catch {
    return { readable: false, canAskAgain: true, status: 'undetermined' };
  }
}

export async function requestMediaLibraryRead(): Promise<boolean> {
  try {
    const perm = await MediaLibrary.requestPermissionsAsync();
    return isMediaLibraryReadable(perm);
  } catch {
    return false;
  }
}

export async function loadMediaRecentsPage(
  kind: MediaRecentsKind,
  after?: string | null,
): Promise<MediaRecentsPage> {
  const result = await MediaLibrary.getAssetsAsync({
    first: MEDIA_RECENTS_PAGE_SIZE,
    after: after || undefined,
    sortBy: [MediaLibrary.SortBy.creationTime],
    mediaType: mediaTypesFor(kind),
  });
  const assets = result.assets.map(mapAsset).filter((asset): asset is MediaRecentAsset => asset != null);
  const page: MediaRecentsPage = {
    assets,
    endCursor: result.endCursor || null,
    hasNextPage: !!result.hasNextPage,
    fetchedAt: Date.now(),
  };
  if (!after) {
    writeMediaRecents(kind, page);
    warmThumbCache(assets);
  }
  return page;
}

export async function prefetchMediaRecents(
  kind: MediaRecentsKind = 'all',
): Promise<MediaRecentsPage | null> {
  const cached = peekMediaRecents(kind);
  if (cached && Date.now() - cached.fetchedAt < STALE_MS) {
    warmThumbCache(cached.assets);
    return cached;
  }
  if (prefetchInFlight && kind === 'all') {
    return prefetchInFlight;
  }

  const run = (async () => {
    const { readable } = await getMediaLibraryReadStatus();
    if (!readable) return cached;
    try {
      return await loadMediaRecentsPage(kind);
    } catch {
      return cached;
    }
  })();

  if (kind === 'all') {
    prefetchInFlight = run;
    try {
      return await run;
    } finally {
      prefetchInFlight = null;
    }
  }
  return run;
}

/** prefetch ב-idle — לא חוסם mount של הקומפוזר. */
export function scheduleMediaRecentsPrefetch(kind: MediaRecentsKind = 'all'): { cancel: () => void } {
  const task = InteractionManager.runAfterInteractions(() => {
    void prefetchMediaRecents(kind);
  });
  return { cancel: () => task.cancel() };
}

export function recentToPicked(asset: MediaRecentAsset): PickedRecentMedia {
  return {
    id: asset.id,
    uri: asset.uri,
    thumbnailUri: asset.uri,
    type: asset.mediaType === 'video' ? 'video' : 'image',
    name: asset.filename,
    width: asset.width || undefined,
    height: asset.height || undefined,
    duration: asset.duration > 0 ? asset.duration : undefined,
  };
}

export async function resolveMediaRecentLocalUri(id: string, fallbackUri: string): Promise<string> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(id);
    const local = info.localUri || info.uri;
    if (local && !local.startsWith('ph://')) return local;
  } catch {
    /* fallback */
  }
  return fallbackUri;
}

export async function resolvePickedMedia(items: PickedRecentMedia[]): Promise<PickedRecentMedia[]> {
  return Promise.all(
    items.map(async (item) => {
      const uri = await resolveMediaRecentLocalUri(item.id, item.uri);
      return { ...item, uri };
    }),
  );
}
