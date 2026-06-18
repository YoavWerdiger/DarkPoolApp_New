import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'appSettings';

export type AppSettings = {
  biometricAuth: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  biometricAuth: false,
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(saved) as Partial<AppSettings>;
    return {
      biometricAuth: parsed.biometricAuth ?? DEFAULT_SETTINGS.biometricAuth,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const raw = saved ? JSON.parse(saved) : {};
    const next = { ...raw, ...patch };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return {
      biometricAuth: next.biometricAuth ?? DEFAULT_SETTINGS.biometricAuth,
    };
  } catch {
    const next = { ...DEFAULT_SETTINGS, ...patch };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}

export async function clearAppCache(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(
    (key) => key.startsWith('cache_') || key.startsWith('temp_') || key === 'offlineData',
  );
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
  return cacheKeys.length;
}
