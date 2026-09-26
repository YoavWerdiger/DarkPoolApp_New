import {
  AURORA_ACTIVE_FPS,
  AURORA_FRAME_MS,
  isAuroraPaused,
  pauseAurora,
  resetAuroraRuntime,
  resumeAurora,
  subscribeAuroraRuntime,
} from '../../components/ui/auroraRuntime';

describe('auroraRuntime', () => {
  afterEach(() => {
    resetAuroraRuntime();
  });

  it('caps the live loop well below 60fps so GL does not fight lists and sheets', () => {
    expect(AURORA_ACTIVE_FPS).toBe(20);
    expect(AURORA_FRAME_MS).toBe(50);
  });

  it('pauses only while at least one owner is open', () => {
    expect(isAuroraPaused()).toBe(false);
    pauseAurora();
    pauseAurora();
    expect(isAuroraPaused()).toBe(true);
    resumeAurora();
    expect(isAuroraPaused()).toBe(true);
    resumeAurora();
    expect(isAuroraPaused()).toBe(false);
  });

  it('notifies listeners on the first pause and the last resume', () => {
    const seen: boolean[] = [];
    const stop = subscribeAuroraRuntime(() => seen.push(isAuroraPaused()));
    pauseAurora();
    pauseAurora();
    resumeAurora();
    resumeAurora();
    stop();
    expect(seen).toEqual([true, false]);
  });
});
