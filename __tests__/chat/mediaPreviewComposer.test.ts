import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, '../../components/chat/MediaPreviewModal.tsx'),
  'utf8',
);

describe('media preview before send', () => {
  it('shows the photo inside the shared frame over a blurred copy, with a green send button', () => {
    expect(src).toMatch(/MediaBlurBackdrop/);
    expect(src).toMatch(/contentFit="cover"/);
    expect(src).toMatch(/ResizeMode\.CONTAIN/);
    expect(src).toMatch(/useAnimatedKeyboard/);
    expect(src).not.toMatch(/ChatComposerDock/);
    expect(src).not.toMatch(/ChatComposerBar/);
    expect(src).not.toMatch(/happy-outline/);
    expect(src).not.toMatch(/<ReactionPicker/);
    expect(src).toMatch(/backgroundColor: tokens\.colors\.background\.cardSolid/);
    // כמו שורת הכתיבה בצ'אט: כפתור שליחה ירוק
    expect(src).toMatch(/backgroundColor: tokens\.colors\.primary\.main/);
    // חלון כמו המצלמה / הסטורי — לא על כל המסך
    expect(src).toMatch(/stableCameraPreviewFrame/);
    expect(src).toMatch(/color: tokens\.colors\.text\.primary/);
  });
});
