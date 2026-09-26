import {
  MEDIA_RECENTS_PAGE_SIZE,
  clearMediaRecentsCache,
  mediaRecentsCacheKey,
  peekMediaRecents,
  writeMediaRecents,
  type MediaRecentAsset,
} from '../../lib/mediaRecentsCache';

const asset = (id: string): MediaRecentAsset => ({
  id,
  uri: `file://${id}.jpg`,
  filename: `${id}.jpg`,
  mediaType: 'photo',
  width: 100,
  height: 100,
  duration: 0,
  creationTime: 1,
});

describe('mediaRecentsCache', () => {
  afterEach(() => {
    clearMediaRecentsCache();
  });

  it('keeps first page small enough for instant paint', () => {
    expect(MEDIA_RECENTS_PAGE_SIZE).toBeGreaterThanOrEqual(30);
    expect(MEDIA_RECENTS_PAGE_SIZE).toBeLessThanOrEqual(60);
  });

  it('keys cache by kind and page size', () => {
    expect(mediaRecentsCacheKey('all')).toBe(`media-recents:all:p${MEDIA_RECENTS_PAGE_SIZE}`);
    expect(mediaRecentsCacheKey('photo')).not.toBe(mediaRecentsCacheKey('video'));
  });

  it('returns the last-written first page without a refetch', () => {
    writeMediaRecents('all', {
      assets: [asset('1'), asset('2')],
      endCursor: 'c2',
      hasNextPage: true,
      fetchedAt: 10,
    });
    expect(peekMediaRecents('all')?.assets.map((item) => item.id)).toEqual(['1', '2']);
    expect(peekMediaRecents('photo')).toBeNull();
  });
});
