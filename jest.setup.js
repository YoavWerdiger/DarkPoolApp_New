// Polyfills / globals that pure-logic tests rely on.
// React Native / Expo modules are auto-mocked by jest-expo; we only
// need to silence the noisy console warnings that jsdom-based tests trigger.

global.__DEV__ = true;

// Stable timezone so date-fns/formatters produce deterministic output.
process.env.TZ = 'UTC';
