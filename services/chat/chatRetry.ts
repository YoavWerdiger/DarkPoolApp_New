// ============================================
// Chat Retry Utilities
// ============================================
// Retry logic for critical operations
// ============================================

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE'],
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const errorCode = error?.code || error?.message || '';
      const isRetryable = opts.retryableErrors.some(code =>
        errorCode.includes(code) || errorCode === code
      );

      if (!isRetryable || attempt === opts.maxRetries) {
        throw error;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Retry with custom condition
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.initialDelay;
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();

      if (condition(result)) {
        return result;
      }

      if (attempt === opts.maxRetries) {
        throw new Error('Max retries reached without meeting condition');
      }
    } catch (error: any) {
      lastError = error;

      if (attempt === opts.maxRetries) {
        throw error;
      }

      const errorCode = error?.code || error?.message || '';
      const isRetryable = opts.retryableErrors.some(code =>
        errorCode.includes(code) || errorCode === code
      );

      if (!isRetryable) {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
  }

  throw lastError || new Error('Retry failed');
}





