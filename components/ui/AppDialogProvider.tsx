import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from 'react';
import UIAlert, { type UIAlertButton } from './UIAlert';
import { registerAppDialog, type AppDialogOptions } from '../../utils/appDialog';

type AppDialogContextValue = {
  showDialog: (opts: AppDialogOptions) => Promise<number | undefined>;
};

const AppDialogContext = createContext<AppDialogContextValue | undefined>(undefined);

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [alertProps, setAlertProps] = useState<{
    title: string;
    message?: string;
    type: AppDialogOptions['type'];
    buttons: UIAlertButton[];
    showIcon: boolean;
    closeOnBackdropPress: boolean;
  }>({
    title: '',
    type: 'info',
    buttons: [{ text: 'אישור', style: 'default' }],
    showIcon: true,
    closeOnBackdropPress: true,
  });

  const resolveRef = React.useRef<((value: number | undefined) => void) | null>(null);

  const handleClose = useCallback(() => {
    setVisible(false);
    if (resolveRef.current) {
      resolveRef.current(undefined);
      resolveRef.current = null;
    }
  }, []);

  const showDialog = useCallback((opts: AppDialogOptions) => {
    return new Promise<number | undefined>((resolve) => {
      resolveRef.current = resolve;
      const raw = opts.buttons?.length ? opts.buttons : [{ text: 'אישור', style: 'default' as const }];
      const wrapped: UIAlertButton[] = raw.map((b, index) => ({
        ...b,
        onPress: () => {
          // Close + resolve FIRST, then run the action on the next tick.
          // Nested legacyAlert()/showAppDialog() from onPress otherwise gets
          // immediately killed by UIAlert's subsequent onClose→setVisible(false).
          const resolveNow = resolveRef.current;
          resolveRef.current = null;
          setVisible(false);
          resolveNow?.(index);
          const action = b.onPress;
          if (action) {
            setTimeout(() => {
              action();
            }, 0);
          }
        },
      }));
      setAlertProps({
        title: opts.title,
        message: opts.message,
        type: opts.type ?? 'info',
        buttons: wrapped,
        showIcon: opts.showIcon ?? true,
        closeOnBackdropPress: opts.closeOnBackdropPress ?? true,
      });
      setVisible(true);
    });
  }, []);

  /** useLayoutEffect — לפני צביעה, כדי ש־legacyAlert יעבוד מיד ולא יפספס קריאות מוקדמות */
  useLayoutEffect(() => {
    registerAppDialog({ show: showDialog });
    return () => registerAppDialog(null);
  }, [showDialog]);

  const ctx = React.useMemo(() => ({ showDialog }), [showDialog]);

  return (
    <AppDialogContext.Provider value={ctx}>
      {children}
      <UIAlert
        visible={visible}
        title={alertProps.title}
        message={alertProps.message}
        type={alertProps.type}
        buttons={alertProps.buttons}
        showIcon={alertProps.showIcon}
        closeOnBackdropPress={alertProps.closeOnBackdropPress}
        onClose={handleClose}
      />
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogContextValue {
  const v = useContext(AppDialogContext);
  if (!v) {
    if (__DEV__) {
      console.warn('useAppDialog: לא בתוך AppDialogProvider');
    }
    return {
      showDialog: async () => undefined,
    };
  }
  return v;
}
