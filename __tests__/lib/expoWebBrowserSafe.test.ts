jest.mock('expo-web-browser', () => {
  throw new Error('expo-web-browser must not load when ExpoWebBrowser is missing');
});

import {
  isExpoWebBrowserAvailable,
  maybeCompleteAuthSession,
  openAuthSessionAsync,
  openBrowserAsync,
} from '../../lib/expoWebBrowserSafe';

describe('expoWebBrowserSafe', () => {
  it('reports availability as a boolean without crashing', () => {
    expect(typeof isExpoWebBrowserAvailable).toBe('boolean');
  });

  it('no-ops auth helpers when the native module is absent', async () => {
    expect(maybeCompleteAuthSession()).toEqual({ type: 'dismiss' });
    await expect(openAuthSessionAsync('https://example.com')).resolves.toEqual({ type: 'cancel' });
    await expect(openBrowserAsync('https://example.com')).resolves.toHaveProperty('type');
  });
});
