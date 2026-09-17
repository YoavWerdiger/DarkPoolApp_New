import {
  chatComposerKeyboardTranslate,
  chatComposerSafeBottomInset,
  chatComposerStickyOffset,
  chatInputBottomPadding,
  CHAT_COMPOSER_ANDROID_MIN_BOTTOM,
  CHAT_COMPOSER_KEYBOARD_GAP,
  CHAT_KEYBOARD_LTR_STYLE,
} from '../../components/chat/chatInputLayout';
import { lockAndroidChatSoftInput, releaseAndroidChatSoftInput, restoreAndroidSoftInputIfUnlocked } from '../../components/chat/androidChatKeyboard';
import { Platform } from 'react-native';
import { AndroidSoftInputModes, KeyboardController } from 'react-native-keyboard-controller';

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

describe('chatComposerStickyOffset', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('keeps closed at 0 so the dock is not pushed down', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(chatComposerStickyOffset(34, 3)).toEqual({ closed: 0, opened: 31 });
  });

  it('matches android translate compensation when inset is the fallback', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(chatComposerStickyOffset(0, 3)).toEqual({
      closed: 0,
      opened: CHAT_COMPOSER_ANDROID_MIN_BOTTOM - 3,
    });
  });
});

describe('CHAT_KEYBOARD_LTR_STYLE', () => {
  it('is an explicit ltr direction (never isRTL)', () => {
    expect(CHAT_KEYBOARD_LTR_STYLE).toEqual({ direction: 'ltr' });
  });
});

describe('lockAndroidChatSoftInput', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    releaseAndroidChatSoftInput();
    Object.defineProperty(Platform, 'OS', { value: originalOS });
    jest.restoreAllMocks();
  });

  it('is a no-op on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const spy = jest.spyOn(KeyboardController, 'setInputMode').mockImplementation(() => {});
    lockAndroidChatSoftInput();
    expect(spy).not.toHaveBeenCalled();
  });

  it('locks ADJUST_NOTHING on Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const spy = jest.spyOn(KeyboardController, 'setInputMode').mockImplementation(() => {});
    lockAndroidChatSoftInput();
    expect(spy).toHaveBeenCalledWith(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
  });
});

describe('restoreAndroidSoftInputIfUnlocked', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    releaseAndroidChatSoftInput();
    Object.defineProperty(Platform, 'OS', { value: originalOS });
    jest.restoreAllMocks();
  });

  it('re-asserts ADJUST_NOTHING while chat is locked', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const modeSpy = jest.spyOn(KeyboardController, 'setInputMode').mockImplementation(() => {});
    const defaultSpy = jest.spyOn(KeyboardController, 'setDefaultMode').mockImplementation(() => {});
    lockAndroidChatSoftInput();
    modeSpy.mockClear();
    restoreAndroidSoftInputIfUnlocked();
    expect(modeSpy).toHaveBeenCalledWith(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    expect(defaultSpy).not.toHaveBeenCalled();
  });

  it('restores default mode after release', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const defaultSpy = jest.spyOn(KeyboardController, 'setDefaultMode').mockImplementation(() => {});
    lockAndroidChatSoftInput();
    releaseAndroidChatSoftInput();
    defaultSpy.mockClear();
    restoreAndroidSoftInputIfUnlocked();
    expect(defaultSpy).toHaveBeenCalled();
  });
});
