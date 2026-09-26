import { readFileSync } from 'fs';
import { join } from 'path';
import { chatComposerKeyboardTranslate } from '../../components/chat/chatInputLayout';
import { repliesSheetKeyboardShrink } from '../../screens/Tweets/repliesSheetKeyboard';

const sheetSrc = readFileSync(
  join(__dirname, '../../screens/Tweets/PostRepliesSheet.tsx'),
  'utf8',
);

describe('repliesSheetKeyboardShrink', () => {
  it('is 0 when the keyboard is closed', () => {
    expect(repliesSheetKeyboardShrink(0, 34)).toBe(0);
    expect(repliesSheetKeyboardShrink(-10, 34)).toBe(0);
  });

  it('matches the composer lift so the list shrinks instead of translating', () => {
    expect(repliesSheetKeyboardShrink(300, 34, 3)).toBe(269);
    expect(repliesSheetKeyboardShrink(300, 34, 3)).toBe(
      Math.abs(chatComposerKeyboardTranslate(300, 34, 3)),
    );
  });
});

describe('PostRepliesSheet keyboard layout', () => {
  it('does not lift the sheet or translate the tweet/replies column', () => {
    expect(sheetSrc).not.toMatch(/\bavoidKeyboard\b/);
    expect(sheetSrc).not.toMatch(/<ChatKeyboardFollow\b/);
    expect(sheetSrc).not.toMatch(/import\s*\{[^}]*\bChatKeyboardFollow\b/);
    expect(sheetSrc).not.toMatch(/\blistFollowY\b/);
    expect(sheetSrc).not.toMatch(/<KeyboardAvoidingView\b/);
  });

  it('shrinks the inner column and keeps the composer on the keyboard', () => {
    expect(sheetSrc).toMatch(/repliesSheetKeyboardShrink/);
    expect(sheetSrc).toMatch(/paddingBottom:\s*listShrinkH\.value/);
    expect(sheetSrc).toMatch(/ChatComposerDock/);
    expect(sheetSrc).toMatch(/overflow:\s*'hidden'/);
    expect(sheetSrc).toMatch(/SOFT_INPUT_ADJUST_NOTHING/);
  });

  it('keeps the original tweet above the list, not inside a keyboard follow wrap', () => {
    const parentIdx = sheetSrc.indexOf('styles.parentCard');
    const listIdx = sheetSrc.indexOf('styles.listWrap');
    expect(parentIdx).toBeGreaterThan(0);
    expect(listIdx).toBeGreaterThan(parentIdx);
    expect(sheetSrc).toMatch(/parentCard:[\s\S]*flexShrink:\s*0/);
    expect(sheetSrc).not.toMatch(/אין תגובות/);
  });
});
