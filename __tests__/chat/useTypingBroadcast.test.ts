/**
 * useTypingBroadcast – verifies the throttle/idle behaviour. We exercise the
 * pure hook by driving a renderer through `react-test-renderer`-style hook
 * harnessing isn't trivial inside the jest-expo/node preset, so instead we
 * test the hook by directly inspecting how its returned `reportKeystroke`
 * and `flushStop` invoke the callback. To do that we render the hook via
 * a minimal React mount + tick the fake timer between assertions.
 *
 * No DOM is required: we use React's TestRenderer-style render through
 * `react-test-renderer` only if available, but in this codebase we use the
 * simpler approach: validate the contract purely via timer behaviour by
 * lifting the implementation under test, since `useTypingBroadcast` is a
 * thin coordinator on top of `setTimeout` and refs.
 *
 * For ergonomics we use jest fake timers and a hand-driven render harness.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useTypingBroadcast } from '../../hooks/useTypingBroadcast';

interface HarnessProps {
  onTyping: (isTyping: boolean) => void;
  apiRef: (api: ReturnType<typeof useTypingBroadcast>) => void;
}

function Harness({ onTyping, apiRef }: HarnessProps) {
  const api = useTypingBroadcast(onTyping, { throttleMs: 1500, idleAfterMs: 2000 });
  apiRef(api);
  return null;
}

function mount(onTyping: (isTyping: boolean) => void) {
  let api!: ReturnType<typeof useTypingBroadcast>;
  let root: TestRenderer.ReactTestRenderer;
  act(() => {
    root = TestRenderer.create(
      React.createElement(Harness, {
        onTyping,
        apiRef: (a) => {
          api = a;
        },
      })
    );
  });
  return {
    api: () => api,
    unmount: () => act(() => root.unmount()),
  };
}

describe('useTypingBroadcast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('publishes onTyping(true) immediately on the first keystroke', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('h'));
    expect(onTyping).toHaveBeenCalledWith(true);
    expect(onTyping).toHaveBeenCalledTimes(1);

    h.unmount();
  });

  it('coalesces keystrokes inside the throttle window', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('h'));
    act(() => h.api().reportKeystroke('he'));
    act(() => h.api().reportKeystroke('hel'));
    act(() => h.api().reportKeystroke('hell'));
    act(() => h.api().reportKeystroke('hello'));

    // Only the FIRST `true` should have fired; subsequent keystrokes are
    // suppressed until the throttle window expires.
    const trueCalls = onTyping.mock.calls.filter((c) => c[0] === true).length;
    expect(trueCalls).toBe(1);

    h.unmount();
  });

  it('re-publishes onTyping(true) after the throttle window elapses', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('a'));
    act(() => jest.advanceTimersByTime(1600));
    act(() => h.api().reportKeystroke('ab'));

    const trueCalls = onTyping.mock.calls.filter((c) => c[0] === true).length;
    expect(trueCalls).toBe(2);

    h.unmount();
  });

  it('publishes onTyping(false) once the user idles for idleAfterMs', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('x'));
    onTyping.mockClear();
    act(() => jest.advanceTimersByTime(2100));

    expect(onTyping).toHaveBeenCalledWith(false);
    expect(onTyping).toHaveBeenCalledTimes(1);

    h.unmount();
  });

  it('publishes onTyping(false) instantly when the input becomes empty', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('hi'));
    onTyping.mockClear();
    act(() => h.api().reportKeystroke(''));

    expect(onTyping).toHaveBeenCalledWith(false);
    expect(onTyping).toHaveBeenCalledTimes(1);

    h.unmount();
  });

  it('flushStop publishes onTyping(false) and cancels any idle timer', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('y'));
    onTyping.mockClear();
    act(() => h.api().flushStop());

    expect(onTyping).toHaveBeenCalledWith(false);

    // No further fires once the idle timer would have elapsed.
    onTyping.mockClear();
    act(() => jest.advanceTimersByTime(5000));
    expect(onTyping).not.toHaveBeenCalled();

    h.unmount();
  });

  it('publishes onTyping(false) on unmount if we were typing', () => {
    const onTyping = jest.fn();
    const h = mount(onTyping);

    act(() => h.api().reportKeystroke('z'));
    onTyping.mockClear();
    h.unmount();

    expect(onTyping).toHaveBeenCalledWith(false);
  });

  it('does nothing if onTyping is undefined', () => {
    const h = mount(undefined as unknown as (b: boolean) => void);
    // Should not throw.
    expect(() => act(() => h.api().reportKeystroke('z'))).not.toThrow();
    expect(() => act(() => h.api().flushStop())).not.toThrow();
    h.unmount();
  });
});
