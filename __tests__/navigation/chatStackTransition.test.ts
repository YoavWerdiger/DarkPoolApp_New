import { readFileSync } from 'fs';
import { join } from 'path';
import { Platform } from 'react-native';
import {
  AFTER_NAV_TRANSITION_FALLBACK_MS,
  scheduleAfterNavigationTransition,
} from '../../hooks/afterNavigationTransition';
import {
  isAuroraPaused,
  pauseAurora,
  resetAuroraRuntime,
  resumeAurora,
} from '../../components/ui/auroraRuntime';
import {
  CHAT_AURORA_HOLD_FAILSAFE_MS,
  CHAT_STACK_ANIMATION,
  CHAT_STACK_ANIMATION_MS,
  createChatStackScreenOptions,
  isChatAuroraTransitionHeld,
  pauseAuroraForChatTransition,
  resetChatAuroraTransitionHold,
  resumeAuroraForChatTransition,
} from '../../navigation/chatStackTransition';

const chatStackSrc = readFileSync(join(__dirname, '../../navigation/ChatStack.tsx'), 'utf8');
const chatGroupSrc = readFileSync(join(__dirname, '../../screens/ChatNew/ChatGroupScreen.tsx'), 'utf8');

describe('chat stack transitions', () => {
  afterEach(() => {
    resetChatAuroraTransitionHold();
    resetAuroraRuntime();
  });

  it('restores a native slide instead of the short fade that felt stuck', () => {
    const options = createChatStackScreenOptions();
    expect(options.animation).toBe('slide_from_right');
    expect(options.animation).toBe(CHAT_STACK_ANIMATION);
    expect(options.freezeOnBlur).toBe(false);
    expect(options.contentStyle).toEqual({ backgroundColor: 'transparent' });
    expect(options.animationDuration).toBe(CHAT_STACK_ANIMATION_MS);
    expect(CHAT_STACK_ANIMATION_MS).toBeGreaterThanOrEqual(300);
    expect(chatStackSrc).not.toContain("animation: 'fade'");
    expect(chatStackSrc).not.toContain('animationDuration: 90');
    expect(chatStackSrc).not.toContain('THREAD_TRANSITION');
  });

  it('opens a conversation from cache without waiting for transitionEnd', () => {
    expect(chatGroupSrc).toContain('primeGroupForOpen');
    expect(chatGroupSrc).toContain('subscribeGroupMessagesCache');
    expect(chatGroupSrc).toMatch(
      /useEffect\(\(\) => \{\s*if \(!groupId\) return;\s*void selectGroup\(groupId\);/,
    );
  });

  it('uses a slightly shorter android duration than ios', () => {
    const expected = Platform.OS === 'android' ? 300 : 350;
    expect(CHAT_STACK_ANIMATION_MS).toBe(expected);
  });

  it('pauses aurora once for a transition and resumes on the matching end', () => {
    expect(isAuroraPaused()).toBe(false);
    pauseAuroraForChatTransition();
    pauseAuroraForChatTransition();
    expect(isChatAuroraTransitionHeld()).toBe(true);
    expect(isAuroraPaused()).toBe(true);
    resumeAuroraForChatTransition();
    expect(isChatAuroraTransitionHeld()).toBe(false);
    expect(isAuroraPaused()).toBe(false);
  });

  it('does not release a sheet aurora pause when the chat transition ends', () => {
    pauseAurora();
    pauseAuroraForChatTransition();
    resumeAuroraForChatTransition();
    expect(isAuroraPaused()).toBe(true);
    resumeAurora();
    expect(isAuroraPaused()).toBe(false);
  });

  it('keeps a failsafe longer than a held swipe-back so aurora stays frozen during the gesture', () => {
    expect(CHAT_AURORA_HOLD_FAILSAFE_MS).toBeGreaterThan(2500);
    expect(CHAT_AURORA_HOLD_FAILSAFE_MS).toBeGreaterThan(CHAT_STACK_ANIMATION_MS);
  });
});

describe('scheduleAfterNavigationTransition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs on transitionEnd and ignores the later fallback', () => {
    const listeners = new Map<string, () => void>();
    const navigation = {
      addListener: (event: string, cb: () => void) => {
        listeners.set(event, cb);
        return () => listeners.delete(event);
      },
    };
    const run = jest.fn();
    scheduleAfterNavigationTransition(navigation, run);
    listeners.get('transitionEnd')?.();
    expect(run).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(AFTER_NAV_TRANSITION_FALLBACK_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('falls back if native-stack never emits transitionEnd', () => {
    const navigation = {
      addListener: () => () => {},
    };
    const run = jest.fn();
    scheduleAfterNavigationTransition(navigation, run);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(AFTER_NAV_TRANSITION_FALLBACK_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run after cancel — pop during the slide must not start heavy work', () => {
    const navigation = {
      addListener: () => () => {},
    };
    const run = jest.fn();
    const stop = scheduleAfterNavigationTransition(navigation, run);
    stop();
    jest.advanceTimersByTime(AFTER_NAV_TRANSITION_FALLBACK_MS);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('useAllowAfterNavigationTransition', () => {
  it('is exported next to the shared after-transition scheduler', () => {
    const src = readFileSync(join(__dirname, '../../hooks/afterNavigationTransition.ts'), 'utf8');
    expect(src).toContain('export function useAllowAfterNavigationTransition');
  });
});
