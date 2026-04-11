import { captureError, addBreadcrumb } from './sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = __DEV__;

function log(level: LogLevel, tag: string, message: string, ...args: unknown[]) {
  if (level === 'debug' && !isDev) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${tag}]`;

  switch (level) {
    case 'debug':
    case 'info':
      if (isDev) console.log(prefix, message, ...args);
      else addBreadcrumb(tag, message);
      break;
    case 'warn':
      if (isDev) console.warn(prefix, message, ...args);
      else addBreadcrumb(tag, `WARN: ${message}`);
      break;
    case 'error': {
      if (isDev) console.error(prefix, message, ...args);
      const errorObj = args[0] instanceof Error ? args[0] : new Error(message);
      captureError(errorObj, { tag, message, extra: args });
      break;
    }
  }
}

export const logger = {
  debug: (tag: string, message: string, ...args: unknown[]) => log('debug', tag, message, ...args),
  info: (tag: string, message: string, ...args: unknown[]) => log('info', tag, message, ...args),
  warn: (tag: string, message: string, ...args: unknown[]) => log('warn', tag, message, ...args),
  error: (tag: string, message: string, ...args: unknown[]) => log('error', tag, message, ...args),
};
