// ESLint (flat config) — בסיס של Expo + כלל צבעים: hex / rgba רק בקבצי הטוקנים.
// הכלל מוגדר כ-warn כי יש מאות צבעים קשיחים קיימים (פריט 44) — המספר הוא מדד ההתקדמות.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const COLOR_LITERAL = [
  {
    selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
    message: 'צבע hex קשיח — השתמשו בטוקן מ-useDesignTokens() / DesignTokens.',
  },
  {
    selector: "Literal[value=/^rgba?\\(/]",
    message: 'צבע rgba קשיח — השתמשו בטוקן מ-useDesignTokens() / DesignTokens.',
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'archive/**',
      'android/**',
      'ios/**',
      'supabase/functions/**',
      'DarkPoolApp_New/**',
      'DASHBOARD_DEPLOY/**',
      '.claude/**',
      '.agents/**',
      'unslop/**',
      'loadtest/**',
      'packages/**',
      'jest.setup.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': ['warn', ...COLOR_LITERAL],
      // כללי React Compiler (eslint-plugin-react-hooks 6+) — האפליקציה לא רצה עם הקומפיילר; אזהרה בלבד
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react/display-name': 'warn',
      // expo-notifications מייצא AndroidImportance כ-enum שה-resolver לא רואה
      'import/namespace': 'off',
    },
  },
  {
    files: ['scripts/**/*.js', '*.config.js', 'jest.setup.js'],
    languageOptions: { globals: { __dirname: 'readonly', __filename: 'readonly', Buffer: 'readonly', process: 'readonly', require: 'readonly', module: 'writable' } },
  },
  {
    // קבצי הטוקנים — המקום היחיד שמותר להגדיר בו צבעים
    files: [
      'components/ui/DesignTokens.ts',
      'components/ui/designTokensStatic.ts',
      'components/ui/softUiPalette.ts',
      'components/chat/chatDesignTokens.ts',
      'constants/**',
      'tailwind.config.js',
      '__tests__/**',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
