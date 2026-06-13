import {
  insiderSubScore,
  premiumSubScore,
  relativeVolumeSubScore,
  repeatSubScore,
  scoreSignal,
  SCORE_WEIGHTS,
} from '../../services/darkpool/darkPoolScoring';

describe('darkPoolScoring – sub-scores', () => {
  describe('premiumSubScore', () => {
    it('returns 0 for non-positive premiums', () => {
      expect(premiumSubScore(0)).toBe(0);
      expect(premiumSubScore(-1)).toBe(0);
      expect(premiumSubScore(Number.NaN)).toBe(0);
    });

    it('is monotonically non-decreasing', () => {
      const xs = [10_000, 100_000, 1_000_000, 5_000_000, 25_000_000, 100_000_000];
      const ys = xs.map(premiumSubScore);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 0.01);
      }
    });

    it('reaches ~50 around mid ($5M)', () => {
      expect(premiumSubScore(5_000_000)).toBeGreaterThan(45);
      expect(premiumSubScore(5_000_000)).toBeLessThan(55);
    });

    it('is clipped to 100', () => {
      expect(premiumSubScore(1e15)).toBeLessThanOrEqual(100);
    });
  });

  describe('repeatSubScore', () => {
    it('is 0 for a single occurrence', () => {
      expect(repeatSubScore(1)).toBe(0);
      expect(repeatSubScore(0)).toBe(0);
    });

    it('grows with repeat count and saturates', () => {
      expect(repeatSubScore(2)).toBeGreaterThan(0);
      expect(repeatSubScore(2)).toBeLessThan(40);
      expect(repeatSubScore(8)).toBeGreaterThan(80);
      expect(repeatSubScore(50)).toBeLessThanOrEqual(100);
    });
  });

  describe('insiderSubScore', () => {
    it('is 0 when no recent insider', () => {
      expect(insiderSubScore(false, 1, 1_000_000)).toBe(0);
    });

    it('is at least 70 with a fresh insider', () => {
      expect(insiderSubScore(true, 0, 1_000_000)).toBeGreaterThanOrEqual(70);
    });

    it('decays as insider age grows', () => {
      const fresh = insiderSubScore(true, 1, 500_000);
      const stale = insiderSubScore(true, 28, 500_000);
      expect(fresh).toBeGreaterThan(stale);
    });

    it('is capped at 100', () => {
      expect(insiderSubScore(true, 0, 1e12)).toBeLessThanOrEqual(100);
    });
  });

  describe('relativeVolumeSubScore', () => {
    it('is 0 for ratios <= 1', () => {
      expect(relativeVolumeSubScore(1)).toBe(0);
      expect(relativeVolumeSubScore(0.5)).toBe(0);
    });

    it('grows with ratio and clips to 100', () => {
      expect(relativeVolumeSubScore(3)).toBeGreaterThan(40);
      expect(relativeVolumeSubScore(10)).toBeGreaterThan(95);
      expect(relativeVolumeSubScore(50)).toBeLessThanOrEqual(100);
    });
  });
});

describe('scoreSignal – composition', () => {
  const baseline = {
    premium: 2_000_000,
    repeatCount: 2,
    hasRecentInsider: false,
    relativeVolume: 2,
    signalType: 'UNUSUAL_VOLUME' as const,
  };

  it('uses 40/20/20/20 weights', () => {
    expect(SCORE_WEIGHTS).toEqual({
      premium: 40,
      repeat: 20,
      insider: 20,
      rel_volume: 20,
    });
  });

  it('returns scores in [0, 100] with consistent breakdown', () => {
    const r = scoreSignal(baseline);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.premium_score).toBeGreaterThanOrEqual(0);
    expect(r.rel_volume_score).toBeGreaterThanOrEqual(0);
  });

  it('gives higher score when insider is present', () => {
    const without = scoreSignal(baseline);
    const withInsider = scoreSignal({
      ...baseline,
      hasRecentInsider: true,
      insiderDaysAgo: 3,
      insiderValue: 500_000,
    });
    expect(withInsider.total).toBeGreaterThan(without.total);
  });

  it('applies +10 confluence boost when premium & relative-volume are both >= 50', () => {
    const high = {
      premium: 20_000_000,
      repeatCount: 4,
      hasRecentInsider: true,
      insiderDaysAgo: 5,
      insiderValue: 1_000_000,
      relativeVolume: 8,
    };
    const conf = scoreSignal({ ...high, signalType: 'INSIDER_DARKPOOL_CONFLUENCE' });
    const noConf = scoreSignal({ ...high, signalType: 'UNUSUAL_VOLUME' });
    expect(conf.total).toBeGreaterThan(noConf.total);
  });

  it('never exceeds 100 even with maximum signals', () => {
    const r = scoreSignal({
      premium: 1e10,
      repeatCount: 100,
      hasRecentInsider: true,
      insiderDaysAgo: 0,
      insiderValue: 1e10,
      relativeVolume: 1e6,
      signalType: 'INSIDER_DARKPOOL_CONFLUENCE',
    });
    expect(r.total).toBeLessThanOrEqual(100);
  });
});
