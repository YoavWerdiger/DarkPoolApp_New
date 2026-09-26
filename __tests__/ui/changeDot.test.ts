import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CHANGE_DOT_SIZE,
  changeToneFromSigned,
  formatSignedChangePct,
} from '../../components/ui/ChangeDot';

const pairSrc = readFileSync(
  join(__dirname, '../../components/ui/ChangeDot.tsx'),
  'utf8'
);
const tickerSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/DarkPoolTickerScreen.tsx'),
  'utf8'
);
const profileSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/PersonPortfolioProfileScreen.tsx'),
  'utf8'
);

describe('changeToneFromSigned', () => {
  it('maps sign to tone without inventing a direction for zero', () => {
    expect(changeToneFromSigned(2.21)).toBe('positive');
    expect(changeToneFromSigned(-1.03)).toBe('negative');
    expect(changeToneFromSigned(0)).toBe('neutral');
    expect(changeToneFromSigned(null)).toBe('neutral');
  });
});

describe('formatSignedChangePct', () => {
  it('keeps + / − on the number, never an arrow', () => {
    expect(formatSignedChangePct(2.21)).toBe('+2.21%');
    expect(formatSignedChangePct(-1.03)).toBe('−1.03%');
    expect(formatSignedChangePct(0)).toBe('0.00%');
    expect(formatSignedChangePct(2.21)).not.toMatch(/[▲▼↑↓]/);
  });
});

describe('CHANGE_DOT_SIZE', () => {
  it('stays a 5–6pt filled circle', () => {
    expect(CHANGE_DOT_SIZE).toBeGreaterThanOrEqual(5);
    expect(CHANGE_DOT_SIZE).toBeLessThanOrEqual(6);
  });
});

describe('SignedChangePair order — $change then dot then %', () => {
  it('renders abs, then ChangeDot, then pct — not a leading or trailing dot', () => {
    const pairFn = pairSrc.slice(pairSrc.indexOf('export function SignedChangePair'));
    expect(pairFn.indexOf('{abs}')).toBeLessThan(pairFn.indexOf('<ChangeDot'));
    expect(pairFn.indexOf('<ChangeDot')).toBeLessThan(pairFn.indexOf('{pct}'));
    expect(pairSrc).toMatch(/\+\$1\.06 • \+2\.21%/);
  });

  it('ticker hero and profile delta use the pair, not a leading-dot blob', () => {
    expect(tickerSrc).toMatch(/SignedChangePair/);
    expect(tickerSrc).toMatch(/absText=\{formatTickerAbsChange/);
    expect(tickerSrc).toMatch(/pctText=\{formatTickerPctChange/);
    expect(tickerSrc).not.toMatch(/▲|▼/);
    expect(profileSrc).toMatch(/SignedChangePair/);
    expect(profileSrc).toMatch(/absText=\{formatCongressDeltaUsd/);
    expect(profileSrc).toMatch(/pctText=\{formatSignedChangePct/);
    expect(profileSrc).not.toMatch(/▲|▼/);
  });
});
