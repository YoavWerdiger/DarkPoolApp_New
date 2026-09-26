import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FIT_CONTENT_SNAP_EXTRA_PX,
  SHEET_BLUR_DEFER_MS,
  SHEET_CLOSE_MS,
  SHEET_EASE_OUT_BEZIER,
  SHEET_OPEN_MS,
  SHEET_SNAP_SPRING,
  resolveFitContentHeightForFrame,
  resolveFitContentSnapPoint,
  resolveSheetVisibleHeightPx,
} from '../../components/ui/BottomSheet/sheetMotion';

const sheetSrc = readFileSync(
  join(__dirname, '../../components/ui/BottomSheet/BottomSheet.tsx'),
  'utf8',
);

describe('sheet open motion tokens', () => {
  it('opens in the WhatsApp / iOS window with no bounce', () => {
    expect(SHEET_OPEN_MS).toBeGreaterThanOrEqual(280);
    expect(SHEET_OPEN_MS).toBeLessThanOrEqual(350);
    expect(SHEET_CLOSE_MS).toBeLessThanOrEqual(SHEET_OPEN_MS + 20);
    expect(SHEET_CLOSE_MS).toBeLessThanOrEqual(320);
    expect(SHEET_SNAP_SPRING.overshootClamping).toBe(true);
    expect(SHEET_SNAP_SPRING.damping).toBeGreaterThanOrEqual(36);
    expect(SHEET_EASE_OUT_BEZIER.y2).toBe(1);
    expect(SHEET_EASE_OUT_BEZIER.y1).toBeGreaterThan(0.5);
  });

  it('defers blur for the whole open so aurora+blur do not paint together', () => {
    expect(SHEET_BLUR_DEFER_MS).toBe(SHEET_OPEN_MS);
    expect(sheetSrc).toContain('SHEET_BLUR_DEFER_MS');
    expect(sheetSrc).toContain('pauseAurora');
  });
});

describe('fitContent open height', () => {
  it('resolves first-frame height from the estimate — never 0', () => {
    expect(resolveSheetVisibleHeightPx([0.4], 800)).toBe(320);
    expect(resolveSheetVisibleHeightPx(undefined, 800)).toBeGreaterThan(0);
    expect(resolveSheetVisibleHeightPx([0], 800)).toBeGreaterThan(0);
  });

  it('keeps the locked height while opening — no second rise', () => {
    expect(resolveFitContentHeightForFrame(true, 320, 480)).toBe(320);
    expect(resolveFitContentHeightForFrame(false, 320, 480)).toBe(480);
    expect(resolveFitContentHeightForFrame(true, 0, 480)).toBe(480);
  });

  it('prefers last measured content height over the estimate', () => {
    expect(
      resolveFitContentSnapPoint({
        contentHeight: 200,
        screenHeight: 800,
        handlePx: 36,
        extraPx: FIT_CONTENT_SNAP_EXTRA_PX,
        initialEstimate: 0.45,
        maxSnap: 0.92,
        minSnap: 0.12,
      }),
    ).toBeCloseTo((200 + 36 + FIT_CONTENT_SNAP_EXTRA_PX) / 800);
    expect(
      resolveFitContentSnapPoint({
        contentHeight: null,
        screenHeight: 800,
        handlePx: 36,
        initialEstimate: 0.45,
      }),
    ).toBe(0.45);
  });

  it('locks mid-open height writes in BottomSheet and keeps last snap in ChatBottomSheet', () => {
    expect(sheetSrc).toContain('resolveFitContentHeightForFrame');
    expect(sheetSrc).toContain('openLockHeightRef');
    expect(sheetSrc).toMatch(/if \(!fitContentOpenDoneRef\.current\) return;/);
    const hookSrc = readFileSync(
      join(__dirname, '../../components/chat/ChatBottomSheet.tsx'),
      'utf8',
    );
    expect(hookSrc).not.toMatch(/setContentHeight\(null\)/);
    expect(hookSrc).toContain('lastHeightRef');
  });
});
