import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, '../../components/chat/MediaPreviewModal.tsx'),
  'utf8',
);

describe('media preview before send', () => {
  it('rides the shared chat keyboard dock and shrinks the image slot with it', () => {
    expect(src).toMatch(/ChatComposerDock/);
    expect(src).toMatch(/useGenericKeyboardHandler/);
    expect(src).toMatch(/chatComposerKeyboardTranslate/);
    expect(src).not.toMatch(/keyboardBackdrop/);
    expect(src).not.toMatch(/Keyboard\.addListener/);
    expect(src).not.toMatch(/backgroundColor:\s*'#000'/);
    expect(src).not.toMatch(/backgroundColor:\s*"#000"/);
  });

  it('keeps the image in a contain slot above the caption', () => {
    const slot = src.indexOf('styles.mediaSlot');
    const dock = src.indexOf('<ChatComposerDock');
    expect(slot).toBeGreaterThan(0);
    expect(dock).toBeGreaterThan(slot);
    expect(src).toMatch(/contentFit="contain"/);
    expect(src).toMatch(/ResizeMode\.CONTAIN/);
  });

  it('opens the shared emoji picker from the caption composer', () => {
    expect(src).toMatch(/happy-outline/);
    expect(src).toMatch(/<ReactionPicker/);
    expect(src).toMatch(/\bembedded\b/);
    expect(src).toMatch(/accessibilityLabel="אימוג'י"/);
  });
});
