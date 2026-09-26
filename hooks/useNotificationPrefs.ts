import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  subscribeNotificationPrefs,
  updateNotificationPref,
  type NotificationPrefKey,
  type NotificationPrefs,
} from '../lib/notificationPrefs';
import { HapticFeedback } from '../utils/hapticFeedback';

export type OsPermissionStatus = 'granted' | 'denied' | 'undetermined';

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [osStatus, setOsStatus] = useState<OsPermissionStatus>('undetermined');

  const refreshOs = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') setOsStatus('granted');
      else if (status === 'denied') setOsStatus('denied');
      else setOsStatus('undetermined');
    } catch {
      setOsStatus('undetermined');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadNotificationPrefs(user?.id);
      if (!cancelled) {
        setPrefs(next);
        setLoading(false);
      }
      await refreshOs();
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshOs]);

  useEffect(() => subscribeNotificationPrefs(setPrefs), []);

  const setPref = useCallback(
    async (key: NotificationPrefKey, value: boolean) => {
      const next = await updateNotificationPref(key, value, user?.id);
      if (key === 'vibration') {
        HapticFeedback.setEnabled(value);
      }
      return next;
    },
    [user?.id],
  );

  return {
    prefs,
    loading,
    osStatus,
    osGranted: osStatus === 'granted',
    refreshOs,
    setPref,
    userId: user?.id ?? null,
  };
}
