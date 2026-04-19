import type { UIAlertButton, UIAlertType } from '../components/ui/UIAlert';

export type AppDialogOptions = {
  title: string;
  message?: string;
  type?: UIAlertType;
  buttons?: UIAlertButton[];
  showIcon?: boolean;
  /** ברירת מחדל true בדיאלוג הגלובלי */
  closeOnBackdropPress?: boolean;
};

type Impl = {
  show: (opts: AppDialogOptions) => Promise<number | undefined>;
};

let impl: Impl | null = null;

/** נקרא מ־AppDialogProvider בלבד */
export function registerAppDialog(controller: Impl | null) {
  impl = controller;
}

/**
 * דיאלוג מעוצב (UIAlert) מכל מקום — גם מחוץ לרכיבי React.
 * מחזיר את אינדקס הכפתור שנלחץ, או undefined אם נסגר בלי בחירה (רקע / כפתור חזרה).
 */
export function showAppDialog(opts: AppDialogOptions): Promise<number | undefined> {
  if (!impl) {
    if (__DEV__) {
      console.warn('[appDialog] AppDialogProvider לא מחובר — השתמש ב-useAppDialog או עטוף את האפליקציה');
    }
    return Promise.resolve(undefined);
  }
  return impl.show(opts);
}

/** כפתור אישור יחיד — מקביל ל־Alert.alert(title, message) */
export function showAppAlert(title: string, message?: string, type: UIAlertType = 'info') {
  return showAppDialog({
    title,
    message,
    type,
    buttons: [{ text: 'אישור', style: 'default' }],
  });
}

/**
 * אישור / ביטול. ב־RTL הכפתור הראשי (אישור) מימין.
 * מחזיר true אם נלחץ אישור.
 */
export function showAppConfirm(
  title: string,
  message?: string,
  options?: {
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }
): Promise<boolean> {
  const confirmText = options?.confirmText ?? 'אישור';
  const cancelText = options?.cancelText ?? 'ביטול';
  return showAppDialog({
    title,
    message,
    type: options?.destructive ? 'warning' : 'info',
    buttons: [
      { text: confirmText, style: options?.destructive ? 'destructive' : 'default' },
      { text: cancelText, style: 'cancel' },
    ],
  }).then((idx) => idx === 0);
}

/** כפתור בפורמט זהה ל־React Native Alert */
export type LegacyAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

function inferAlertType(title: string, message?: string): UIAlertType {
  const s = `${title} ${message ?? ''}`;
  if (/שגיאה|שגיאת|נכשל|לא ניתן|בעיה|שגיאה\b|error|failed/i.test(s)) return 'error';
  if (/הצלחה|הושלם|נשמר|הועתק|מעולה|תודה|הופעל|נרשמת|הורד|הועתקה/i.test(s)) return 'success';
  if (/אזהרה|מחיקה|לבטל\?|האם אתה|למחוק|עזוב|הסר/i.test(s)) return 'warning';
  return 'info';
}

/**
 * תחליף ל־`Alert.alert` — אותה חתימה: (כותרת, הודעה?, כפתורים?).
 * משתמש בדיאלוג המעוצב הגלובלי. לא מחזיר Promise (כמו Alert המקורי).
 */
export function legacyAlert(title: string, message?: string, buttons?: LegacyAlertButton[]): void {
  void (async () => {
    const type = inferAlertType(title, message);
    const btns: UIAlertButton[] =
      buttons && buttons.length > 0
        ? buttons.map((b) => ({
            text: b.text,
            style: (b.style as UIAlertButton['style']) ?? 'default',
            onPress: b.onPress,
          }))
        : [{ text: 'אישור', style: 'default' }];
    const multi = btns.length > 1;
    await showAppDialog({
      title,
      message: message || undefined,
      type,
      buttons: btns,
      showIcon: true,
      closeOnBackdropPress: !multi,
    });
  })();
}
