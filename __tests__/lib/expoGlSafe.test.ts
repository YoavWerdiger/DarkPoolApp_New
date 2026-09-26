jest.mock('expo-gl', () => {
  throw new Error('expo-gl must not load when ExpoGL is missing');
});

import { GLView, isExpoGlAvailable } from '../../lib/expoGlSafe';

describe('expoGlSafe', () => {
  it('reports availability as a boolean without crashing', () => {
    expect(typeof isExpoGlAvailable).toBe('boolean');
  });

  it('does not expose GLView when the native ExpoGL module is absent', () => {
    expect(GLView).toBeNull();
    expect(isExpoGlAvailable).toBe(false);
  });
});
