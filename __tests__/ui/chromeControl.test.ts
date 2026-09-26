import { readFileSync } from 'fs';
import { join } from 'path';
import { CHROME_UICARD } from '../../components/ui/chromeControl';

const composerSrc = readFileSync(
  join(__dirname, '../../components/chat/ChatComposerBar.tsx'),
  'utf8',
);

describe('chromeControl', () => {
  it('uses soft navChrome UICard recipe for chat composer', () => {
    expect(CHROME_UICARD.variant).toBe('soft');
    expect(CHROME_UICARD.disableBlur).toBe(true);
    expect(composerSrc).toMatch(/CHROME_UICARD/);
    expect(composerSrc).toMatch(/chromeSurfaceCardStyle/);
  });
});
