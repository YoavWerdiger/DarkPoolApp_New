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

describe('SignedChangePair order — $change then %', () => {
  it('renders abs then pct, without a colored dot', () => {
    const pairFn = pairSrc.slice(pairSrc.indexOf('export function SignedChangePair'));
    const signedFn = pairSrc.slice(
      pairSrc.indexOf('export function SignedChange('),
      pairSrc.indexOf('export function SignedChangePair')
    );
    expect(pairFn.indexOf('{abs}')).toBeLessThan(pairFn.indexOf('{pct}'));
    expect(pairFn).not.toMatch(/<ChangeDot/);
    expect(signedFn).not.toMatch(/<ChangeDot/);
    expect(pairSrc).toMatch(/\+\$1\.06 \+2\.21%/);
  });

  it('ticker hero uses the pair, profile snapshot puts a dot only between $ and %', () => {
    expect(tickerSrc).toMatch(/SignedChangePair/);
    expect(tickerSrc).toMatch(/absText=\{formatTickerAbsChange/);
    expect(tickerSrc).toMatch(/pctText=\{formatTickerPctChange/);
    expect(tickerSrc).not.toMatch(/▲|▼/);
    expect(tickerSrc).not.toMatch(/<ChangeDot/);
    expect(profileSrc).toMatch(/formatCongressDeltaUsd\(periodDelta\.usd\)/);
    expect(profileSrc).toMatch(/formatSignedChangePct\(periodDelta\.pct\)/);
    expect(profileSrc).toMatch(/styles\.deltaDot/);
    expect(profileSrc).not.toMatch(/SignedChangePair/);
    expect(profileSrc).not.toMatch(/▲|▼/);
  });
});
