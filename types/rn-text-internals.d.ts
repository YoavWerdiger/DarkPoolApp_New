// מודולים פנימיים של react-native ש-components/ui/appText.tsx משתמש בהם (אין להם טיפוסים)
declare module 'react-native/Libraries/Text/TextAncestorContext' {
  import type { Context } from 'react';
  const TextAncestorContext: Context<boolean>;
  export default TextAncestorContext;
}
declare module 'react-native/Libraries/StyleSheet/flattenStyle' {
  export default function flattenStyle(style: unknown): Record<string, unknown> | undefined;
}
