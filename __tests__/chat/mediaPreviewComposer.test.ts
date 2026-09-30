import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, '../../components/chat/MediaPreviewModal.tsx'),
  'utf8',
);

describe('media preview before send', () => {
  it('shows the photo full-bleed over a blurred copy, with floating theme-colored controls', () => {
    expect(src).toMatch(/MediaBlurBackdrop/);
    expect(src).toMatch(/contentFit="cover"/);
    expect(src).toMatch(/ResizeMode\.CONTAIN/);
    expect(src).toMatch(/useAnimatedKeyboard/);
    expect(src).not.toMatch(/ChatComposerDock/);
    expect(src).not.toMatch(/ChatComposerBar/);
    expect(src).not.toMatch(/happy-outline/);
    expect(src).not.toMatch(/<ReactionPicker/);
    expect(src).toMatch(/backgroundColor: tokens\.colors\.background\.cardSolid/);
    expect(src).toMatch(/backgroundColor: tokens\.colors\.primary\.lightCta/);
    expect(src).toMatch(/color: tokens\.colors\.text\.primary/);
  });
});
