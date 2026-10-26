import { useEffect, useState } from 'react';

/**
 * משאיר Modal ממונט עד סוף אנימציית הסגירה. הסרה מיידית של Modal פתוח ב-iOS
 * (`{visible && <Modal/>}` או `if (!visible) return null`) משאירה מודל «יתום»
 * שחוסם מודלים / מסכים שנפתחים אחריו — המסך קופא עד יציאה מהאפליקציה.
 */
export function useDelayedUnmount(visible: boolean, delayMs = 500): boolean {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), delayMs);
    return () => clearTimeout(t);
  }, [visible, delayMs]);
  return visible || mounted;
}
