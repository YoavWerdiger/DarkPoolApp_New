import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import { AuroraHostContext } from '../../components/ui/DarkGreenAuroraBackground';

describe('ScreenGradientBackground host skip', () => {
  it('does not mount a second animated layer under AuroraHost', () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AuroraHostContext.Provider value={true}>
          <ScreenGradientBackground />
        </AuroraHostContext.Provider>,
      );
    });
    expect(tree!.toJSON()).toBeNull();
  });

  it('still draws a static copy when animated is off (sheets / export)', () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <AuroraHostContext.Provider value={true}>
          <ScreenGradientBackground animated={false} />
        </AuroraHostContext.Provider>,
      );
    });
    expect(tree!.toJSON()).not.toBeNull();
  });
});
