/**
 * גלילה אופקית שמתחילה מימין בממשק RTL (עברית/ערבית).
 * שורש האפליקציה LTR — ScrollView אופקי עם direction:'rtl' רק על התוכן הופך את הסדר,
 * אבל הגלילה מתחילה משמאל (על הפריטים האחרונים). כאן: הפריט הראשון בקצה הימני
 * (row-reverse) ובטעינה גוללים לקצה הימני — דטרמיניסטי בשתי הפלטפורמות, בלי RTL של ScrollView.
 */
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { IS_RTL_UI } from '../../lib/i18n/direction';

// ScrollView בטיפוסי RN 0.88 הוא ערך ולא טיפוס מופע — ref כללי
export const RtlHorizontalScroll = forwardRef<any, ScrollViewProps>(function RtlHorizontalScroll(
  { style, contentContainerStyle, onContentSizeChange, onScrollBeginDrag, onLayout, ...rest },
  ref,
) {
  const innerRef = useRef<any>(null);
  useImperativeHandle(ref, () => innerRef.current);
  // עד שהמשתמש גולל בעצמו — נשארים מוצמדים לקצה הימני (גם כשנטען תוכן נוסף)
  const userScrolledRef = useRef(false);

  const pinRight = useCallback(() => {
    if (!IS_RTL_UI || userScrolledRef.current) return;
    innerRef.current?.scrollToEnd({ animated: false });
  }, []);

  return (
    <ScrollView
      {...rest}
      ref={innerRef}
      horizontal
      // ה-ScrollView עצמו LTR: באנדרואיד HorizontalScrollView יורש direction:'rtl' מההורה
      // (wrap של הסקשן) ומשקף את קואורדינטות הגלילה — scrollToEnd נחת בקצה הלא נכון והסדר התהפך
      style={[style, IS_RTL_UI ? { direction: 'ltr' } : null]}
      contentContainerStyle={[
        contentContainerStyle,
        IS_RTL_UI ? { direction: 'ltr', flexDirection: 'row-reverse' } : null,
      ]}
      onContentSizeChange={(w, h) => {
        pinRight();
        onContentSizeChange?.(w, h);
      }}
      onLayout={(e) => {
        pinRight();
        onLayout?.(e);
      }}
      onScrollBeginDrag={(e) => {
        userScrolledRef.current = true;
        onScrollBeginDrag?.(e);
      }}
    />
  );
});

export default RtlHorizontalScroll;
