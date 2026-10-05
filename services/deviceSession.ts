/**
 * מכשיר פעיל יחיד למשתמש.
 * - כל התקנה מקבלת מזהה קבוע (SecureStore, לא מסונכרן ל-iCloud).
 * - claim_active_device מסמן את המכשיר הנוכחי כפעיל; אחרי claim מנתקים את שאר הסשנים
 *   (refresh tokens) כדי שמכשיר ישן לא יוכל להמשיך.
 * - אדמינים פטורים (enforced=false בשרת).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { makeClientMessageId } from './chat/chatOfflineQueue';
import { logger } from '../utils/logger';

const DEVICE_ID_KEY = 'darkpool:device_id';
let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    /* noop */
  }
  const id = makeClientMessageId(); // UUID v4
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    /* noop — נשאר בזיכרון לסשן הזה */
  }
  cachedDeviceId = id;
  return id;
}

export type DeviceState = 'active' | 'conflict' | 'exempt' | 'unknown';

/** בודק אם המכשיר הזה הוא הפעיל. אין רשומה עדיין → טוען בעלות בשקט. */
export async function checkActiveDevice(): Promise<DeviceState> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('get_my_active_device');
    if (error || !data) return 'unknown';
    const state = data as { device_id: string | null; enforced: boolean };
    if (!state.enforced) {
      if (state.device_id !== deviceId) await claimActiveDevice({ revokeOthers: false });
      return 'exempt';
    }
    if (!state.device_id) {
      await claimActiveDevice({ revokeOthers: true });
      return 'active';
    }
    return state.device_id === deviceId ? 'active' : 'conflict';
  } catch (e) {
    logger.warn('deviceSession', 'check failed', e);
    return 'unknown';
  }
}

/** «התחבר מכאן» — המכשיר הזה הופך לפעיל, המכשיר האחר מתנתק */
export async function claimActiveDevice(opts: { revokeOthers: boolean }): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.rpc('claim_active_device', {
      p_device_id: deviceId,
      p_platform: Platform.OS,
    });
    if (error) {
      logger.warn('deviceSession', 'claim failed', error);
      return false;
    }
    const enforced = !!(data as { enforced?: boolean } | null)?.enforced;
    if (enforced && opts.revokeOthers) {
      // מבטל refresh tokens של שאר המכשירים (הסשן הנוכחי נשאר)
      await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
    }
    return true;
  } catch (e) {
    logger.warn('deviceSession', 'claim threw', e);
    return false;
  }
}

/** האזנה בזמן אמת — מכשיר אחר תפס את החשבון */
export function subscribeActiveDevice(userId: string, onTakenOver: () => void): () => void {
  let disposed = false;
  const channel = supabase
    .channel(`active-device:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_active_device', filter: `user_id=eq.${userId}` },
      async (payload) => {
        if (disposed) return;
        const next = (payload.new as { device_id?: string } | null)?.device_id;
        if (!next) return;
        const mine = await getDeviceId();
        if (next !== mine) {
          const state = await checkActiveDevice();
          if (state === 'conflict') onTakenOver();
        }
      },
    )
    .subscribe();
  return () => {
    disposed = true;
    void supabase.removeChannel(channel);
  };
}
