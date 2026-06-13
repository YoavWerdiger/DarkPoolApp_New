import {
  chatComposerPaddingBottom,
  chatComposerSafeBottomInset,
  chatComposerStickyOffset,
  chatInputBottomPadding,
  CHAT_COMPOSER_ANDROID_MIN_BOTTOM,
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

describe('chatComposerStickyOffset', () => {
  it('keeps closed at 0 and compensates opened by safe area', () => {
    expect(chatComposerStickyOffset(34)).toEqual({ closed: 0, opened: 26 });
  });
});

describe('chatComposerPaddingBottom', () => {
  it('uses safe inset when keyboard closed and small gap when open', () => {
    expect(chatComposerPaddingBottom(34, false)).toBe(34);
    expect(chatComposerPaddingBottom(34, true)).toBe(8);
  });
});

describe('chatInputBottomPadding', () => {
  it('keeps fixed minimal inner padding', () => {
    expect(chatInputBottomPadding(34, false, 8)).toBe(8);
    expect(chatInputBottomPadding(34, true, 8)).toBe(8);
    expect(chatInputBottomPadding(0, true, 6)).toBe(6);
  });
});
