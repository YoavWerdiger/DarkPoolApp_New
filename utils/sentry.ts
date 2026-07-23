import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.warn('Sentry DSN not configured – error tracking disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    maxBreadcrumbs: 50,
    environment: __DEV__ ? 'development' : 'production',
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    beforeSend(event) {
      if (__DEV__) return null;
      // Strip PII from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.data?.url) {
            try {
              const url = new URL(bc.data.url);
              url.searchParams.delete('token');
              url.searchParams.delete('apikey');
              bc.data.url = url.toString();
            } catch (_) {}
          }
          return bc;
        });
      }
      return event;
    },
  });
}

export function captureError(error: unknown, context?: Record<string, any>) {
  if (__DEV__) {
    console.error('[Sentry]', error, context);
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function addBreadcrumb(category: string, message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

export function setUser(id: string, email?: string) {
  Sentry.setUser({ id, email });
}

export function clearUser() {
  Sentry.setUser(null);
}

export { Sentry };
