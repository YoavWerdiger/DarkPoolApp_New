// Polyfills / globals that pure-logic tests rely on.
// React Native / Expo modules are auto-mocked by jest-expo; we only
// need to silence the noisy console warnings that jsdom-based tests trigger.

global.__DEV__ = true;

// React 19 / react-test-renderer expects this flag when running under jest
// in a "node" environment. Without it every act() call prints a warning
// about updates outside an act-wrapped scope.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global).IS_REACT_ACT_ENVIRONMENT = true;

// Stable timezone so date-fns/formatters produce deterministic output.
process.env.TZ = 'UTC';
