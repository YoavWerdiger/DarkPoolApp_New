/**
 * Text גלובלי של האפליקציה — Heebo לפי fontWeight.
 * metro.config.js מפנה את react-native/Libraries/Text/Text לכאן (כולל Animated.Text וספריות),
 * כי ב-RN 0.86 Text הוא קומפוננטת פונקציה ו-Text.render (installAppFont הישן) כבר לא קיים.
 *
 * - fontFamily שאינו Heebo (אייקונים, Assistant ב-CTA, monospace) — לא נוגעים.
 * - Text מקונן בלי fontWeight משלו — לא נוגעים (יורש מההורה, כמו ב-RN).
 * - אחרי בחירת הקובץ fontWeight חוזר ל-400, כדי שהמערכת לא תעבה שוב קובץ שכבר בולד.
 */
import React, { useContext } from 'react';
// הקובץ המקורי בנתיב מלא — metro לא מפנה בקשה שמגיעה מהקובץ הזה
import OriginalText from 'react-native/Libraries/Text/Text';
import TextAncestorContext from 'react-native/Libraries/Text/TextAncestorContext';
import flattenStyle from 'react-native/Libraries/StyleSheet/flattenStyle';
import { resolveAppFontFamily } from './appFontFamily';

type AnyProps = { style?: unknown; [key: string]: unknown };

function AppText(props: AnyProps) {
  const hasTextAncestor = useContext(TextAncestorContext);
  const flat = (flattenStyle(props.style as never) ?? {}) as { fontFamily?: unknown; fontWeight?: unknown };
  const family = typeof flat.fontFamily === 'string' ? flat.fontFamily : '';
  const Base = OriginalText as unknown as React.ComponentType<AnyProps>;

  if (family && !family.startsWith('Heebo')) return <Base {...props} />;
  if (hasTextAncestor && flat.fontWeight == null && !family) return <Base {...props} />;

  return (
    <Base
      {...props}
      style={[props.style, { fontFamily: resolveAppFontFamily(flat.fontWeight), fontWeight: '400' }]}
    />
  );
}

AppText.displayName = 'Text';

export default AppText;
