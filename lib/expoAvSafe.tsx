/**
 * Audio / video for Expo Go 57 + native builds.
 *
 * Expo Go no longer ships ExponentAV (`expo-av`). Static `import 'expo-av'`
 * crashes at boot. We probe native modules and load, in order:
 *   1. expo-audio + expo-video (SDK 55+ / Expo Go 57)
 *   2. expo-av when ExponentAV still exists (older dev clients)
 *   3. last-resort stubs so chat never takes the app down
 *
 * Callers keep the expo-av-shaped Audio / Video API (Sound, Recording, Video).
 */
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export const ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
} as const;

type LoadedExpoAv = {
  Audio: any;
  Video: any;
  ResizeMode: any;
};

function probeNative(name: string): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return requireOptionalNativeModule(name) != null;
  } catch {
    return false;
  }
}

function tryLoadExpoAudio(): any | null {
  if (!probeNative('ExpoAudio')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-audio');
    if (!mod?.createAudioPlayer || !mod?.AudioModule) return null;
    return mod;
  } catch {
    return null;
  }
}

function tryLoadExpoVideo(): any | null {
  if (!probeNative('ExpoVideo')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-video');
    if (!mod?.VideoView || !mod?.useVideoPlayer) return null;
    return mod;
  } catch {
    return null;
  }
}

function tryLoadExpoAv(): LoadedExpoAv | null {
  if (!probeNative('ExponentAV')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-av') as LoadedExpoAv;
    if (!mod?.Audio || !mod?.Video) return null;
    return mod;
  } catch {
    return null;
  }
}

const expoAudio = tryLoadExpoAudio();
const expoVideo = tryLoadExpoVideo();
const expoAv = tryLoadExpoAv();

export const isExpoAudioAvailable = expoAudio != null;
export const isExpoVideoAvailable = expoVideo != null;
/** True when recording / playback can run (expo-audio or leftover expo-av). */
export const isExpoAvAvailable = isExpoAudioAvailable || expoAv != null;

const unloadedStatus = { isLoaded: false as const };

const ANDROID_OUTPUT: Record<number, string> = {
  0: 'default',
  1: '3gp',
  2: 'mpeg4',
  3: 'amrnb',
  4: 'amrwb',
  6: 'aac_adts',
  8: 'mpeg2ts',
  9: 'webm',
};

const ANDROID_ENCODER: Record<number, string> = {
  0: 'default',
  1: 'amr_nb',
  2: 'amr_wb',
  3: 'aac',
  4: 'he_aac',
  5: 'aac_eld',
};

function mapAndroidOutput(value: unknown): string {
  if (typeof value === 'string') return value.toLowerCase() === 'mpeg_4' ? 'mpeg4' : value;
  if (typeof value === 'number') return ANDROID_OUTPUT[value] ?? 'mpeg4';
  return 'mpeg4';
}

function mapAndroidEncoder(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return ANDROID_ENCODER[value] ?? 'aac';
  return 'aac';
}

/** expo-av nested RecordingOptions → expo-audio flat RecordingOptions */
function toExpoAudioRecordingOptions(avOpts: any): any {
  if (!avOpts) {
    return {
      ...(expoAudio?.RecordingPresets?.HIGH_QUALITY ?? {}),
      isMeteringEnabled: true,
      numberOfChannels: 1,
    };
  }
  if (typeof avOpts.extension === 'string' && typeof avOpts.sampleRate === 'number') {
    return { isMeteringEnabled: true, ...avOpts };
  }
  const android = avOpts.android ?? {};
  const ios = avOpts.ios ?? {};
  const web = avOpts.web ?? {};
  const isIos = Platform.OS === 'ios';
  return {
    isMeteringEnabled: avOpts.isMeteringEnabled !== false,
    extension: isIos ? (ios.extension ?? '.wav') : (android.extension ?? '.m4a'),
    sampleRate: isIos ? (ios.sampleRate ?? 16000) : (android.sampleRate ?? 44100),
    numberOfChannels: isIos ? (ios.numberOfChannels ?? 1) : (android.numberOfChannels ?? 1),
    bitRate: isIos ? (ios.bitRate ?? 128000) : (android.bitRate ?? 128000),
    android: {
      outputFormat: mapAndroidOutput(android.outputFormat),
      audioEncoder: mapAndroidEncoder(android.audioEncoder),
      extension: android.extension ?? '.m4a',
    },
    ios: {
      outputFormat: ios.outputFormat ?? 'lpcm',
      audioQuality: ios.audioQuality ?? 0x60,
      linearPCMBitDepth: ios.linearPCMBitDepth ?? 16,
      linearPCMIsBigEndian: ios.linearPCMIsBigEndian ?? false,
      linearPCMIsFloat: ios.linearPCMIsFloat ?? false,
      extension: ios.extension ?? '.wav',
      sampleRate: ios.sampleRate,
    },
    web: {
      mimeType: web.mimeType ?? 'audio/webm',
      bitsPerSecond: web.bitsPerSecond ?? 128000,
    },
  };
}

function mapAudioMode(mode: any): any {
  if (!mode || typeof mode !== 'object') return {};
  const out: Record<string, unknown> = { ...mode };
  if ('allowsRecordingIOS' in mode) out.allowsRecording = mode.allowsRecordingIOS;
  if ('playsInSilentModeIOS' in mode) out.playsInSilentMode = mode.playsInSilentModeIOS;
  if ('staysActiveInBackground' in mode) out.shouldPlayInBackground = mode.staysActiveInBackground;
  return out;
}

function avStatusFromAudioPlayer(player: any, extra?: { didJustFinish?: boolean }) {
  const status = player?.currentStatus;
  const currentTime = status?.currentTime ?? player?.currentTime ?? 0;
  const duration = status?.duration ?? player?.duration ?? 0;
  const isLoaded =
    status?.isLoaded ?? player?.isLoaded ?? (duration > 0 || !!player?.playing);
  return {
    isLoaded,
    isPlaying: status?.playing ?? player?.playing ?? false,
    isBuffering: status?.isBuffering ?? player?.isBuffering ?? false,
    didJustFinish: extra?.didJustFinish ?? status?.didJustFinish ?? false,
    positionMillis: currentTime * 1000,
    durationMillis: duration * 1000,
    rate: status?.playbackRate ?? player?.playbackRate ?? 1,
    shouldPlay: status?.playing ?? player?.playing ?? false,
    isLooping: status?.loop ?? player?.loop ?? false,
    isMuted: status?.mute ?? player?.muted ?? false,
  };
}

class ExpoAudioSound {
  private player: any;
  private statusSub: { remove: () => void } | null = null;
  private onStatus: ((status: any) => void) | null = null;

  constructor(player: any) {
    this.player = player;
    try {
      this.statusSub = player.addListener?.('playbackStatusUpdate', (status: any) => {
        this.onStatus?.(
          avStatusFromAudioPlayer(this.player, { didJustFinish: !!status?.didJustFinish }),
        );
      });
    } catch {
      /* older runtimes */
    }
  }

  static async createAsync(source: any, initialStatus: any = {}) {
    const uri = typeof source === 'string' ? source : source?.uri;
    const player = expoAudio.createAudioPlayer(uri ? { uri } : (uri ?? null), {
      updateInterval: initialStatus.progressUpdateIntervalMillis ?? 80,
    });
    const sound = new ExpoAudioSound(player);
    if (initialStatus.isLooping) player.loop = true;
    if (initialStatus.isMuted) player.muted = true;
    if (typeof initialStatus.volume === 'number') player.volume = initialStatus.volume;
    if (typeof initialStatus.rate === 'number') {
      try {
        player.setPlaybackRate?.(initialStatus.rate);
      } catch {
        player.playbackRate = initialStatus.rate;
      }
    }
    if (initialStatus.positionMillis > 0) {
      await player.seekTo(initialStatus.positionMillis / 1000);
    }
    if (initialStatus.shouldPlay) player.play();
    return { sound, status: await sound.getStatusAsync() };
  }

  setOnPlaybackStatusUpdate(cb?: ((status: any) => void) | null) {
    this.onStatus = cb ?? null;
  }

  async playAsync() {
    this.player.play();
    return this.getStatusAsync();
  }

  async pauseAsync() {
    this.player.pause();
    return this.getStatusAsync();
  }

  async stopAsync() {
    this.player.pause();
    await this.player.seekTo(0);
    return this.getStatusAsync();
  }

  async unloadAsync() {
    this.statusSub?.remove?.();
    this.statusSub = null;
    this.onStatus = null;
    try {
      this.player.pause();
    } catch {
      /* already released */
    }
    try {
      this.player.release?.();
    } catch {
      /* noop */
    }
    return unloadedStatus;
  }

  async setPositionAsync(millis: number) {
    await this.player.seekTo(Math.max(0, millis) / 1000);
    return this.getStatusAsync();
  }

  async setStatusAsync(status: any) {
    if (!status) return this.getStatusAsync();
    if (typeof status.positionMillis === 'number') {
      await this.player.seekTo(status.positionMillis / 1000);
    }
    if (typeof status.isLooping === 'boolean') this.player.loop = status.isLooping;
    if (typeof status.isMuted === 'boolean') this.player.muted = status.isMuted;
    if (typeof status.volume === 'number') this.player.volume = status.volume;
    if (typeof status.shouldPlay === 'boolean') {
      if (status.shouldPlay) this.player.play();
      else this.player.pause();
    }
    return this.getStatusAsync();
  }

  async setRateAsync(rate: number, shouldCorrectPitch?: boolean) {
    try {
      this.player.setPlaybackRate?.(rate, shouldCorrectPitch ? 'high' : undefined);
    } catch {
      this.player.playbackRate = rate;
    }
    return this.getStatusAsync();
  }

  async getStatusAsync() {
    return avStatusFromAudioPlayer(this.player);
  }
}

class ExpoAudioRecording {
  private recorder: any = null;
  private statusCb: ((status: any) => void) | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private progressInterval = 32;
  private lastUri: string | null = null;

  setOnRecordingStatusUpdate(cb?: ((status: any) => void) | null) {
    this.statusCb = cb ?? null;
    this.syncPoll();
  }

  setProgressUpdateInterval(ms: number) {
    this.progressInterval = Math.max(16, ms || 32);
    this.syncPoll();
  }

  private emitStatus() {
    if (!this.statusCb || !this.recorder) return;
    try {
      this.statusCb(this.mapStatus(this.recorder.getStatus()));
    } catch {
      /* recorder not prepared */
    }
  }

  private mapStatus(s: any) {
    return {
      canRecord: !!s?.canRecord,
      isRecording: !!s?.isRecording,
      isDoneRecording: !s?.isRecording && (s?.durationMillis ?? 0) > 0,
      durationMillis: s?.durationMillis ?? ((this.recorder?.currentTime ?? 0) * 1000),
      metering: s?.metering,
    };
  }

  private syncPoll() {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
    if (!this.statusCb || !this.recorder) return;
    this.poll = setInterval(() => this.emitStatus(), this.progressInterval);
  }

  async prepareToRecordAsync(options?: unknown) {
    const recOpts = toExpoAudioRecordingOptions(options);
    const AudioModule = expoAudio.AudioModule;
    this.recorder = new AudioModule.AudioRecorder(recOpts);
    await this.recorder.prepareToRecordAsync(recOpts);
    this.syncPoll();
  }

  async startAsync() {
    this.recorder?.record();
    this.syncPoll();
  }

  async pauseAsync() {
    this.recorder?.pause();
    this.emitStatus();
  }

  async stopAndUnloadAsync() {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
    try {
      await this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.lastUri = this.recorder?.uri ?? this.lastUri;
    try {
      this.recorder?.release?.();
    } catch {
      /* noop */
    }
    this.recorder = null;
    return { uri: this.lastUri };
  }

  getURI() {
    return this.recorder?.uri ?? this.lastUri;
  }

  async getStatusAsync() {
    if (!this.recorder) {
      return {
        canRecord: false,
        isRecording: false,
        isDoneRecording: !!this.lastUri,
        durationMillis: 0,
      };
    }
    return this.mapStatus(this.recorder.getStatus());
  }
}

class StubSound {
  static async createAsync() {
    return { sound: new StubSound(), status: unloadedStatus };
  }
  setOnPlaybackStatusUpdate(_cb?: unknown) {}
  async playAsync() {
    return unloadedStatus;
  }
  async pauseAsync() {
    return unloadedStatus;
  }
  async stopAsync() {
    return unloadedStatus;
  }
  async unloadAsync() {
    return unloadedStatus;
  }
  async setPositionAsync(_millis: number) {
    return unloadedStatus;
  }
  async setStatusAsync(_status: unknown) {
    return unloadedStatus;
  }
  async setRateAsync(_rate: number, _shouldCorrectPitch?: boolean) {
    return unloadedStatus;
  }
  async getStatusAsync() {
    return unloadedStatus;
  }
}

class StubRecording {
  setOnRecordingStatusUpdate(_cb?: unknown) {}
  setProgressUpdateInterval(_ms?: number) {}
  async prepareToRecordAsync(_options?: unknown) {}
  async startAsync() {}
  async pauseAsync() {}
  async stopAndUnloadAsync() {
    return { uri: null };
  }
  getURI() {
    return null;
  }
  async getStatusAsync() {
    return {
      canRecord: false,
      isRecording: false,
      isDoneRecording: false,
      durationMillis: 0,
    };
  }
}

const stubAudio = {
  Sound: StubSound,
  Recording: StubRecording,
  requestPermissionsAsync: async () => ({
    status: 'denied' as const,
    granted: false,
    canAskAgain: false,
    expires: 'never' as const,
  }),
  getPermissionsAsync: async () => ({
    status: 'denied' as const,
    granted: false,
    canAskAgain: false,
    expires: 'never' as const,
  }),
  setAudioModeAsync: async (_mode?: unknown) => {},
  setIsEnabledAsync: async (_enabled?: boolean) => {},
  AndroidOutputFormat: {
    DEFAULT: 0,
    THREE_GPP: 1,
    MPEG_4: 2,
    AMR_NB: 3,
    AMR_WB: 4,
    AAC_ADIF: 5,
    AAC_ADTS: 6,
    RTP_AVP: 7,
    MPEG2TS: 8,
    WEBM: 9,
  },
  AndroidAudioEncoder: {
    DEFAULT: 0,
    AMR_NB: 1,
    AMR_WB: 2,
    AAC: 3,
    HE_AAC: 4,
    AAC_ELD: 5,
  },
  IOSOutputFormat: {
    LINEARPCM: 'lpcm',
    MPEG4AAC: 'aac ',
  },
  IOSAudioQuality: {
    MIN: 0,
    LOW: 0x20,
    MEDIUM: 0x40,
    HIGH: 0x60,
    MAX: 0x7f,
  },
};

function buildExpoAudioFacade(mod: any) {
  return {
    ...stubAudio,
    Sound: ExpoAudioSound,
    Recording: ExpoAudioRecording,
    requestPermissionsAsync: () => mod.requestRecordingPermissionsAsync(),
    getPermissionsAsync: () => mod.getRecordingPermissionsAsync(),
    setAudioModeAsync: (mode?: unknown) => mod.setAudioModeAsync(mapAudioMode(mode)),
    setIsEnabledAsync: (enabled?: boolean) => mod.setIsAudioActiveAsync(enabled !== false),
  };
}

class StubVideo extends React.Component<{
  style?: StyleProp<ViewStyle>;
  source?: unknown;
  resizeMode?: string;
  shouldPlay?: boolean;
  isMuted?: boolean;
  isLooping?: boolean;
  useNativeControls?: boolean;
  posterSource?: unknown;
  usePoster?: boolean;
  onPlaybackStatusUpdate?: (status: { isLoaded: false }) => void;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
}> {
  playAsync = async () => unloadedStatus;
  pauseAsync = async () => unloadedStatus;
  stopAsync = async () => unloadedStatus;
  unloadAsync = async () => unloadedStatus;
  setPositionAsync = async (_millis: number) => unloadedStatus;
  setStatusAsync = async (_status: unknown) => unloadedStatus;
  setRateAsync = async (_rate: number, _shouldCorrectPitch?: boolean) => unloadedStatus;
  setOnPlaybackStatusUpdate = (_cb?: unknown) => {};
  presentFullscreenPlayer = async () => {};
  dismissFullscreenPlayer = async () => {};
  getStatusAsync = async () => unloadedStatus;

  render() {
    return (
      <View
        style={[
          {
            backgroundColor: '#111111',
            alignItems: 'center',
            justifyContent: 'center',
          },
          this.props.style,
        ]}
        pointerEvents={this.props.pointerEvents}
      >
        <Text
          style={{
            color: '#888888',
            fontSize: 13,
            textAlign: 'center',
            paddingHorizontal: 16,
          }}
        >
          ניגון וידאו לא זמין ב-Expo Go
        </Text>
      </View>
    );
  }
}

function createExpoVideoCompat(videoMod: any) {
  const { useVideoPlayer, VideoView } = videoMod;

  const ExpoVideoCompat = React.forwardRef(function ExpoVideoCompat(
    props: {
      style?: StyleProp<ViewStyle>;
      source?: { uri?: string } | string | null;
      resizeMode?: string;
      shouldPlay?: boolean;
      isMuted?: boolean;
      isLooping?: boolean;
      useNativeControls?: boolean;
      posterSource?: any;
      usePoster?: boolean;
      onPlaybackStatusUpdate?: (status: any) => void;
      onLoadStart?: () => void;
      onLoad?: () => void;
      onError?: () => void;
      pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
    },
    ref: React.Ref<any>,
  ) {
    const uri =
      typeof props.source === 'string' ? props.source : (props.source?.uri ?? null);
    const viewRef = useRef<any>(null);
    const onStatusRef = useRef(props.onPlaybackStatusUpdate);
    onStatusRef.current = props.onPlaybackStatusUpdate;
    const onLoadRef = useRef(props.onLoad);
    onLoadRef.current = props.onLoad;
    const onErrorRef = useRef(props.onError);
    onErrorRef.current = props.onError;
    const [showPoster, setShowPoster] = useState(!!props.usePoster && !!props.posterSource);

    const player = useVideoPlayer(uri, (p: any) => {
      p.loop = !!props.isLooping;
      p.muted = !!props.isMuted;
      p.timeUpdateEventInterval = 0.1;
      if (props.shouldPlay) p.play();
    });

    const prevUri = useRef(uri);
    useEffect(() => {
      if (prevUri.current === uri) return;
      prevUri.current = uri;
      props.onLoadStart?.();
      setShowPoster(!!props.usePoster && !!props.posterSource);
      if (uri) {
        void player.replaceAsync?.(uri).catch(() => onErrorRef.current?.());
      }
    }, [uri, player, props.onLoadStart, props.usePoster, props.posterSource]);

    useEffect(() => {
      player.loop = !!props.isLooping;
      player.muted = !!props.isMuted;
    }, [player, props.isLooping, props.isMuted]);

    useEffect(() => {
      if (props.shouldPlay) player.play();
      else player.pause();
    }, [player, props.shouldPlay]);

    const emit = (extra?: { didJustFinish?: boolean }) => {
      const durationSec = player.duration ?? 0;
      const posSec = player.currentTime ?? 0;
      onStatusRef.current?.({
        isLoaded: player.status === 'readyToPlay' || durationSec > 0 || player.playing,
        isPlaying: !!player.playing,
        didJustFinish: !!extra?.didJustFinish,
        positionMillis: posSec * 1000,
        durationMillis: durationSec * 1000,
        isMuted: !!player.muted,
        isLooping: !!player.loop,
        rate: player.playbackRate ?? 1,
      });
    };

    useEffect(() => {
      const subs = [
        player.addListener?.('statusChange', ({ status, error }: any) => {
          if (error) onErrorRef.current?.();
          if (status === 'readyToPlay') onLoadRef.current?.();
          emit();
        }),
        player.addListener?.('playingChange', () => emit()),
        player.addListener?.('playToEnd', () => emit({ didJustFinish: true })),
        player.addListener?.('timeUpdate', () => emit()),
        player.addListener?.('sourceLoad', () => onLoadRef.current?.()),
      ].filter(Boolean);
      return () => {
        for (const s of subs) {
          try {
            s.remove?.();
          } catch {
            /* noop */
          }
        }
      };
    }, [player]);

    useImperativeHandle(ref, () => ({
      playAsync: async () => {
        player.play();
        emit();
      },
      pauseAsync: async () => {
        player.pause();
        emit();
      },
      stopAsync: async () => {
        player.pause();
        player.currentTime = 0;
        emit();
      },
      unloadAsync: async () => {
        player.pause();
      },
      setPositionAsync: async (millis: number) => {
        player.currentTime = Math.max(0, millis) / 1000;
        emit();
      },
      setStatusAsync: async (status: any) => {
        if (typeof status?.positionMillis === 'number') {
          player.currentTime = status.positionMillis / 1000;
        }
        if (typeof status?.shouldPlay === 'boolean') {
          if (status.shouldPlay) player.play();
          else player.pause();
        }
        if (typeof status?.isMuted === 'boolean') player.muted = status.isMuted;
        if (typeof status?.isLooping === 'boolean') player.loop = status.isLooping;
        if (typeof status?.rate === 'number') player.playbackRate = status.rate;
        emit();
      },
      setRateAsync: async (rate: number) => {
        player.playbackRate = rate;
      },
      setOnPlaybackStatusUpdate: (cb?: (status: any) => void) => {
        onStatusRef.current = cb;
      },
      presentFullscreenPlayer: async () => viewRef.current?.enterFullscreen?.(),
      dismissFullscreenPlayer: async () => viewRef.current?.exitFullscreen?.(),
      getStatusAsync: async () => {
        const durationSec = player.duration ?? 0;
        const posSec = player.currentTime ?? 0;
        return {
          isLoaded: player.status === 'readyToPlay' || durationSec > 0 || player.playing,
          isPlaying: !!player.playing,
          positionMillis: posSec * 1000,
          durationMillis: durationSec * 1000,
        };
      },
    }));

    const contentFit =
      props.resizeMode === ResizeMode.COVER || props.resizeMode === 'cover'
        ? 'cover'
        : props.resizeMode === ResizeMode.STRETCH || props.resizeMode === 'stretch'
          ? 'fill'
          : 'contain';

    return (
      <View style={props.style} pointerEvents={props.pointerEvents}>
        <VideoView
          ref={viewRef}
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          nativeControls={!!props.useNativeControls}
          onFirstFrameRender={() => setShowPoster(false)}
        />
        {showPoster && props.posterSource ? (
          <Image
            source={props.posterSource}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        ) : null}
      </View>
    );
  });

  ExpoVideoCompat.displayName = 'ExpoVideoCompat';
  return ExpoVideoCompat;
}

const audioFacade = expoAudio
  ? buildExpoAudioFacade(expoAudio)
  : (expoAv?.Audio ?? stubAudio);

const VideoCompat = expoVideo
  ? createExpoVideoCompat(expoVideo)
  : (expoAv?.Video ?? StubVideo);

/** Real playback when expo-audio / expo-av exists; otherwise no-op stubs. */
export const Audio: any = audioFacade;
export const Video: any = VideoCompat;

export const EXPO_AV_UNAVAILABLE_MESSAGE =
  'הקלטת קול וניגון אודיו/וידאו לא זמינים בסביבה הזו. ב-Expo Go 57 הם אמורים לעבוד דרך expo-audio / expo-video.';

/** Prefetch remote/local audio so voice bubbles start without a cold buffer. */
export function prefetchAudioUris(uris: string[]): void {
  // ExpoAudio.web מחזיר void מ-preload, native מחזיר Promise — לכן Promise.resolve.
  const preload = expoAudio?.preload as ((source: any) => Promise<void> | void) | undefined;
  if (!preload || uris.length === 0) return;
  for (const uri of uris) {
    if (!uri || typeof uri !== 'string') continue;
    if (!(uri.startsWith('http') || uri.startsWith('file:') || uri.startsWith('content:'))) continue;
    void Promise.resolve(preload(uri)).catch(() => {
      /* best effort — missing native module / bad url must not crash chat */
    });
  }
}
