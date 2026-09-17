// preset jest-expo/node פותר את expo-audio / expo-av ל-build של הדפדפן, שמשתמש
// ב-`Audio` הגלובלי של ה-DOM — שלא קיים בסביבת node. הסוויטה הזו בודקת דווקא את
// מסלול ה-stubs של expoAvSafe, לכן מציגים את המודולים כלא-זמינים במקום לשנות קוד אפליקציה.
jest.mock('expo-audio', () => ({}));
jest.mock('expo-av', () => ({}));

import { Audio, ResizeMode, isExpoAvAvailable, prefetchAudioUris } from '../../lib/expoAvSafe';

describe('expoAvSafe', () => {
  it('exports ResizeMode without loading expo-av', () => {
    expect(ResizeMode.CONTAIN).toBe('contain');
    expect(ResizeMode.COVER).toBe('cover');
    expect(ResizeMode.STRETCH).toBe('stretch');
  });

  it('reports availability as a boolean (false in Jest without ExpoAudio / ExponentAV)', () => {
    expect(typeof isExpoAvAvailable).toBe('boolean');
  });

  it('Audio stubs do not throw at import or on common calls', async () => {
    expect(Audio.AndroidOutputFormat.MPEG_4).toBe(2);
    expect(Audio.AndroidAudioEncoder.AAC).toBe(3);
    expect(Audio.IOSOutputFormat.LINEARPCM).toBe('lpcm');
    expect(Audio.IOSAudioQuality.HIGH).toBe(0x60);

    await expect(Audio.setAudioModeAsync({ playsInSilentModeIOS: true })).resolves.toBeUndefined();

    const perm = await Audio.requestPermissionsAsync();
    expect(perm.status === 'granted' || perm.status === 'denied').toBe(true);

    const { sound, status } = await Audio.Sound.createAsync({ uri: 'file://noop.wav' });
    expect(status).toBeTruthy();
    await expect(sound.getStatusAsync()).resolves.toBeTruthy();
    await expect(sound.unloadAsync()).resolves.toBeTruthy();

    const recording = new Audio.Recording();
    recording.setOnRecordingStatusUpdate(() => {});
    recording.setProgressUpdateInterval?.(32);
    await expect(recording.prepareToRecordAsync({})).resolves.toBeUndefined();
    // ה-stub מחזיר את אותה צורה כמו המודול האמיתי, עם uri ריק — בלי לזרוק.
    const stopped = await recording.stopAndUnloadAsync();
    expect(stopped).toHaveProperty('uri');
    expect(stopped.uri).toBeNull();
  });

  it('prefetchAudioUris is a no-op when expo-audio is missing', () => {
    expect(() => prefetchAudioUris(['https://example.com/a.m4a', 'file://local.wav'])).not.toThrow();
  });
});
