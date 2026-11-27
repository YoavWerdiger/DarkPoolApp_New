/** סגנונות של AddStoryFullScreen.tsx — הועברו מקובץ המסך (פריט 52, פיצול קבצים ענקיים). */
import { ROOT_DIR } from '../../../lib/i18n/direction';
import { StyleSheet } from 'react-native';
import { chatPalette } from '../chatDesignTokens';
import { M, SW, SH, GALLERY_THUMB, CAPTURE_SIZE, CAPTURE_RING, PILL_W, PILL_GAP, CHROME_FILL, CHROME_LINE } from './storyEditorParts';
import StaticDesignTokens from '../../../components/ui/DesignTokens';

export const s = StyleSheet.create({
  fullFlex: { flex: 1 },
  recordedVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW,
    height: SH,
    backgroundColor: M.base,
  },
  recordedVideoFill: {
    width: SW,
    height: SH,
  },
  videoPreviewRoot: {
    overflow: 'visible',
  },
  videoWait: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: M.base,
  },
  root: {
    flex: 1,
    backgroundColor: M.base,
    overflow: 'hidden',
  },

  /* ---- Horizontal swipe strip ---- */
  modeStrip: {
    flexDirection: 'row',
    width: SW * 2,
    height: '100%',
  },
  modePanel: {
    width: SW,
    height: '100%',
  },
  cameraMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: M.base,
  },

  /* Chrome overlays sit above background Pans (Android touch isolation). */
  chromeLayer: {
    zIndex: 40,
    elevation: 12,
  },

  /* ---- Camera top ---- */
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 40,
    elevation: 12,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHROME_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBtnCompact: {
    backgroundColor: chatPalette.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },

  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 5,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 260,
    zIndex: 5,
  },

  /* ---- Camera bottom ---- */
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 12,
  },

  galleryExpanded: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  galleryGrid: {
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  galleryGridItem: {
    flex: 1 / 3,
    aspectRatio: 0.75,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  galleryGridImg: {
    width: '100%',
    height: '100%',
  },
  gridVideoTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: StaticDesignTokens.colors.overlay,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  gridVideoDuration: {
    color: M.text,
    fontSize: 10,
    fontWeight: '600',
  },

  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 32,
  },

  galleryBtn: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: CHROME_FILL,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryBtnImg: {
    width: '100%',
    height: '100%',
  },

  captureOuter: {
    width: CAPTURE_RING,
    height: CAPTURE_RING,
    borderRadius: CAPTURE_RING / 2,
    borderWidth: 3,
    borderColor: M.text,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 41,
    elevation: 16,
  },
  captureInner: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    backgroundColor: M.text,
  },
  captureRecording: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: M.record,
  },

  flipBtn: {
    width: GALLERY_THUMB,
    height: GALLERY_THUMB,
    borderRadius: GALLERY_THUMB / 2,
    backgroundColor: CHROME_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ---- Mode switcher overlay ---- */
  modeSwitcherOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 45,
    elevation: 14,
    pointerEvents: 'box-none',
  },
  modeSwitcherTrack: {
    flexDirection: 'row',
    backgroundColor: CHROME_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_LINE,
    borderRadius: 22,
    padding: 3,
    gap: PILL_GAP,
  },
  modeSwitcherHighlight: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: PILL_W,
    height: 32,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  modePill: {
    width: PILL_W,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  modePillText: {
    color: M.text,
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: M.scrim,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* ---- Permission fallback ---- */
  permissionBtn: {
    marginTop: 20,
    backgroundColor: chatPalette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionBtnText: {
    color: M.text,
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- Text mode ---- */
  textInputArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  textBigInput: {
    color: M.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 42,
    minHeight: 80,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  textCounter: {
    color: M.controlStrong,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  textBgPicker: {
    paddingTop: 4,
  },
  textBgScroll: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  bgDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bgDotActive: {
    borderColor: M.text,
    borderWidth: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  /* ---- Preview ---- */
  previewBlurDim: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // בלי overflow:hidden — חיתוך מעל AVPlayerLayer משאיר וידאו שחור ב-iOS (כמו המצלמה);
  // המדיה והציור כבר בגודל החלון בדיוק
  previewFrame: {
    position: 'absolute',
    left: 0,
    width: SW,
    backgroundColor: M.base,
  },
  overlayLayer: {
    backgroundColor: 'transparent',
    // בזמן גרירה לפח (בתחתית המסך, מתחת לחלון) הטקסט נשאר גלוי
    overflow: 'visible',
    zIndex: 5,
  },
  /** direction:ltr — כמו StoryViewer: Modal לא תמיד מכבד forceRTL. כלים משמאל, חזרה מימין */
  previewTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    direction: ROOT_DIR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  previewTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewTopGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 30,
    zIndex: 10,
  },
  previewTopRow: {
    /** כמו StoryViewer progressRow — נועל LTR כדי שהסדר לא יהפוך פעמיים ב-Modal */
    flexDirection: 'row',
    direction: ROOT_DIR,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  toolRail: {
    position: 'absolute',
    left: 14,
    zIndex: 20,
    gap: 10,
    alignItems: 'center',
  },
  previewToolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CHROME_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_LINE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 50,
    zIndex: 10,
  },
  sendRow: {
    flexDirection: 'row',
    direction: ROOT_DIR,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sendChevronBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chatPalette.primary,
  },

  /* ---- Drawing mode ---- */
  drawTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 25,
  },
  drawIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHROME_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_LINE,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  drawDonePill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: CHROME_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CHROME_LINE,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  drawDoneText: {
    color: M.text,
    fontSize: 15,
    fontWeight: '600',
  },
  drawBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    paddingTop: 12,
    backgroundColor: StaticDesignTokens.colors.onMedia.scrimMedium,
  },
  drawStrokeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
  },
  strokeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  strokeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: M.text,
  },
  drawColorScroll: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  drawColorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  drawColorDotActive: {
    borderColor: M.text,
    borderWidth: 3,
    transform: [{ scale: 1.18 }],
  },

  /* ---- Trash drop zone ---- */
  trashZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 28,
  },
  trashCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: StaticDesignTokens.colors.overlay,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashCircleActive: {
    backgroundColor: 'rgba(255,59,48,0.85)',
    borderColor: M.text,
    transform: [{ scale: 1.15 }],
  },
  trashHint: {
    color: M.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textShadowColor: M.scrimStrong,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ---- Upload overlay ---- */
});
