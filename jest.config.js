/** @type {import('jest').Config} */
module.exports = {
  // We currently only have pure-logic unit tests (services, utils, calc).
  // jest-expo/node skips the React Native / HMR bootstrap which fails outside
  // a Metro/Expo runtime. When component tests are added, switch back to
  // 'jest-expo' or use multi-project config.
  preset: 'jest-expo/node',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Stay away from build artifacts and the legacy duplicate project tree —
  // they cause haste-map module-naming collisions on jest-expo.
  modulePathIgnorePatterns: [
    '<rootDir>/DarkPoolApp_New/',
    '<rootDir>/DASHBOARD_DEPLOY/',
    '<rootDir>/dist/',
    '<rootDir>/android/',
    '<rootDir>/ios/',
    '<rootDir>/DarkPooliOS/',
  ],
  haste: {
    forceNodeFilesystemAPI: true,
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@react-navigation|@unimodules/.*|sentry-expo|native-base|@sentry/.*|@shopify/.*|@gorhom/.*|lucide-react-native|react-native-svg|@supabase/.*)',
  ],
  collectCoverageFrom: [
    'services/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      // Initial floor; raise as coverage grows.
      lines: 5,
      statements: 5,
    },
  },
};
