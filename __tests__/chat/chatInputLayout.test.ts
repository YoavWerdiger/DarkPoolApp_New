import {
  chatComposerKeyboardTranslate,
  chatComposerSafeBottomInset,
  chatInputBottomPadding,
  CHAT_COMPOSER_ANDROID_MIN_BOTTOM,
  CHAT_COMPOSER_KEYBOARD_GAP,
} from '../../components/chat/chatInputLayout';
import { Platform } from 'react-native';

describe('chatComposerSafeBottomInset', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('uses safe area when larger than android minimum', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(chatComposerSafeBottomInset(34)).toBe(34);
  });

  it('falls back to android minimum when inset is 0', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(chatComposerSafeBottomInset(0)).toBe(CHAT_COMPOSER_ANDROID_MIN_BOTTOM);
  });

  it('uses ios inset as-is', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(chatComposerSafeBottomInset(34)).toBe(34);
    expect(chatComposerSafeBottomInset(0)).toBe(0);
  });
});

describe('chatComposerKeyboardTranslate', () => {
  it('returns 0 when keyboard is closed', () => {
    expect(chatComposerKeyboardTranslate(0, 34)).toBe(0);
  });

  it('keeps 3px gap above keyboard with constant bottom inset', () => {
    expect(chatComposerKeyboardTranslate(300, 34, 3)).toBe(-269);
  });

  it('compensates android fallback inset when safe area is 0', () => {
    expect(chatComposerKeyboardTranslate(280, 16, 3)).toBe(-267);
  });
});

describe('chatInputBottomPadding', () => {
  it('keeps fixed minimal inner padding', () => {
    expect(chatInputBottomPadding(8)).toBe(8);
    expect(chatInputBottomPadding(6)).toBe(6);
  });
});

describe('CHAT_COMPOSER_KEYBOARD_GAP', () => {
  it('is 3px', () => {
    expect(CHAT_COMPOSER_KEYBOARD_GAP).toBe(3);
  });
});
