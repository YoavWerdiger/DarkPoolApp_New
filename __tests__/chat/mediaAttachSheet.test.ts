import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MEDIA_ATTACH_FIRST_PAGE,
  MEDIA_ATTACH_GRID_COLS,
  MEDIA_ATTACH_GRID_ROW,
  MEDIA_ATTACH_PEEK_MAX,
  MEDIA_ATTACH_PERMISSION_CTA,
  MEDIA_ATTACH_SNAP_POINTS,
  formatMediaDuration,
  mediaAttachActionsBlockHeightPx,
  mediaAttachPeekPlan,
  mediaAttachPresentation,
  mediaAttachSecondaryRowCount,
  mediaAttachShouldQueryLibrary,
  resolveSheetOpenSnapIndex,
  toggleMediaSelection,
} from '../../lib/mediaAttachSheet';
import { MEDIA_RECENTS_PAGE_SIZE } from '../../lib/mediaRecentsCache';

const sheetSrc = readFileSync(
  join(__dirname, '../../components/chat/MediaPickerSheet.tsx'),
  'utf8',
);

describe('media attach sheet — WhatsApp open path', () => {
  it('peek shows attach actions even without photos or permission', () => {
    const peek = mediaAttachPresentation({
      permission: 'denied',
      cachedCount: 0,
      loading: true,
      expanded: false,
    });
    expect(peek.canPresent).toBe(true);
    expect(peek.showPermissionCta).toBe(false);
    expect(peek.showGrid).toBe(false);
    expect(peek.showSkeleton).toBe(false);
    expect(sheetSrc).toContain('מצלמה');
    expect(sheetSrc).toContain('גלריה');
    expect(sheetSrc).not.toContain('צילום מהיר');
    expect(sheetSrc).not.toContain('תמונות וסרטונים');
    expect(sheetSrc).not.toContain('chromeSurfaceCardStyle');
    expect(sheetSrc).toMatch(
      /primaryTile:\s*\{[^}]*backgroundColor:\s*tokens\.colors\.background\.primary/,
    );
    expect(sheetSrc).toMatch(
      /actionCircle:\s*\{[^}]*backgroundColor:\s*tokens\.colors\.background\.primary/,
    );
    expect(sheetSrc).toContain("label: 'שיתוף'");
    expect(sheetSrc).toContain("label: 'סקר'");
    expect(sheetSrc).toContain('primaryRow');
    expect(sheetSrc).toContain('secondaryRow');
    expect(sheetSrc).toContain('peekRecentsTitle');
    expect(sheetSrc).toContain('ChatAttachCameraSheet');
    expect(sheetSrc).not.toContain('כלים נוספים');
    expect(sheetSrc).toContain('galleryChrome');
    expect(sheetSrc).toContain('scheduleMediaRecentsPrefetch');
    expect(sheetSrc).toContain('runAfterSheetDismiss');
    expect(sheetSrc).toContain('onBuiltinCamera');
    expect(sheetSrc).toContain('openSnapIndex={0}');
    expect(sheetSrc).not.toContain('launchImageLibraryAsync');
  });

  it('does not flip fitContent after the sheet is visible', () => {
    expect(sheetSrc).not.toContain('fitContent={!expanded}');
    expect(sheetSrc).not.toMatch(/fitContent\s*=/);
    expect(sheetSrc).toContain('mediaAttachPeekPlan');
    expect(sheetSrc).toContain('lockAttachOpen');
  });

  it('does not wait on library permission before showing the peek menu', () => {
    expect(mediaAttachShouldQueryLibrary(false)).toBe(false);
    expect(mediaAttachShouldQueryLibrary(true)).toBe(true);
    expect(sheetSrc).toContain('mediaAttachShouldQueryLibrary(expanded)');
    expect(sheetSrc).toMatch(
      /if \(!visible \|\| !mediaAttachShouldQueryLibrary\(expanded\)\) return/,
    );
  });

  it('sizes a stable peek snap for the action menu without a later resize', () => {
    const chatSecondary = 4;
    const menu = mediaAttachPeekPlan({
      screenHeight: 852,
      thumbSize: 128,
      bottomPad: 54,
      cachedCount: 0,
      secondaryCount: chatSecondary,
    });
    const withThumbs = mediaAttachPeekPlan({
      screenHeight: 852,
      thumbSize: 128,
      bottomPad: 54,
      cachedCount: 8,
      secondaryCount: chatSecondary,
    });
    const again = mediaAttachPeekPlan({
      screenHeight: 852,
      thumbSize: 128,
      bottomPad: 54,
      cachedCount: 0,
      secondaryCount: chatSecondary,
    });
    expect(menu.showPeekRecents).toBe(false);
    expect(menu.peekSnap).toBe(again.peekSnap);
    expect(menu.peekSnap).toBeLessThan(0.42);
    expect(withThumbs.peekSnap).toBeLessThanOrEqual(MEDIA_ATTACH_PEEK_MAX);
  });

  it('shows peek recents when they fit above a compact action block', () => {
    const withThumbs = mediaAttachPeekPlan({
      screenHeight: 852,
      thumbSize: 128,
      bottomPad: 54,
      cachedCount: 8,
      secondaryCount: 0,
    });
    expect(withThumbs.showPeekRecents).toBe(true);
    expect(withThumbs.peekSnap).toBeGreaterThan(
      mediaAttachPeekPlan({
        screenHeight: 852,
        thumbSize: 128,
        bottomPad: 54,
        cachedCount: 0,
        secondaryCount: 0,
      }).peekSnap,
    );
  });

  it('omits the recents strip from peek when it would blow the short snap', () => {
    const tight = mediaAttachPeekPlan({
      screenHeight: 640,
      thumbSize: 200,
      bottomPad: 72,
      cachedCount: 4,
      secondaryCount: 4,
    });
    expect(tight.showPeekRecents).toBe(false);
    expect(tight.peekSnap).toBeLessThanOrEqual(MEDIA_ATTACH_PEEK_MAX);
  });

  it('asks for photo permission only after expanding the gallery', () => {
    const gallery = mediaAttachPresentation({
      permission: 'denied',
      cachedCount: 0,
      loading: false,
      expanded: true,
    });
    expect(gallery.showPermissionCta).toBe(true);
    expect(gallery.showGrid).toBe(false);
    expect(MEDIA_ATTACH_PERMISSION_CTA).toBe('אפשר גישה לתמונות');
  });

  it('keeps first page small enough for instant paint', () => {
    expect(MEDIA_ATTACH_FIRST_PAGE).toBe(30);
    expect(MEDIA_RECENTS_PAGE_SIZE).toBe(MEDIA_ATTACH_FIRST_PAGE);
    expect(MEDIA_ATTACH_SNAP_POINTS[0]).toBeLessThan(MEDIA_ATTACH_SNAP_POINTS[1]);
    expect(resolveSheetOpenSnapIndex(MEDIA_ATTACH_SNAP_POINTS, 0)).toBe(0);
  });

  it('keeps the 3-col grid RTL without row-reverse', () => {
    expect(MEDIA_ATTACH_GRID_COLS).toBe(3);
    expect(MEDIA_ATTACH_GRID_ROW.direction).toBe('rtl');
    expect(MEDIA_ATTACH_GRID_ROW.flexDirection).toBe('row');
    expect(MEDIA_ATTACH_GRID_ROW.flexDirection).not.toBe('row-reverse');
    expect(sheetSrc).toContain('MEDIA_ATTACH_GRID_ROW');
  });

  it('lays out secondary tools on up to four columns per row', () => {
    expect(mediaAttachSecondaryRowCount(0)).toBe(0);
    expect(mediaAttachSecondaryRowCount(4)).toBe(1);
    expect(mediaAttachSecondaryRowCount(5)).toBe(2);
    expect(mediaAttachActionsBlockHeightPx(4)).toBeGreaterThan(
      mediaAttachActionsBlockHeightPx(0),
    );
  });

  it('toggles selection immediately and formats video duration', () => {
    expect(toggleMediaSelection([], 'a', 10)).toEqual(['a']);
    expect(toggleMediaSelection(['a'], 'a', 10)).toEqual([]);
    expect(toggleMediaSelection(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
    expect(formatMediaDuration(65)).toBe('1:05');
    expect(formatMediaDuration(0)).toBe('');
  });
});
