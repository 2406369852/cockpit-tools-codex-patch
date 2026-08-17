export const UPDATE_CHECK_RETRY_DELAYS_MS = [800, 2000, 5000] as const;
export const UPDATE_DOWNLOAD_RETRY_DELAYS_MS = [1000, 2500, 5000] as const;
export const UPDATE_CANCELED_ERROR_CODE = 'UPDATE_CANCELED_BY_USER';

const URL_PATTERN = /https?:\/\/[^\s)]+/gi;
const NON_RETRYABLE_HINTS = [
  'signature',
  'checksum',
  'hash mismatch',
  'no matching platform',
  'fallback platforms',
  'platforms object',
  'invalid type',
  'invalid value',
  'permission denied',
  'no space left',
  'disk full',
];
const RETRYABLE_NETWORK_HINTS = [
  'error sending request',
  'failed to send request',
  'timeout',
  'timed out',
  'network',
  'dns',
  'tls',
  'ssl',
  'connection reset',
  'connection refused',
  'connection aborted',
  'broken pipe',
  'unexpected eof',
  'temporarily unavailable',
  'temporary failure',
  'name or service not known',
  'no route to host',
  'unreachable',
];

export type RetryContext = {
  retryIndex: number;
  totalRetries: number;
  delayMs: number;
  error: unknown;
};

export type RetryOptions = {
  delaysMs: readonly number[];
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (context: RetryContext) => void | Promise<void>;
};

export function normalizeUpdaterErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function sanitizeUpdaterErrorMessage(error: unknown, maxLength = 220): string {
  const normalized = normalizeUpdaterErrorMessage(error).replace(URL_PATTERN, '[URL]');
  const compact = normalized.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength)}...`;
}

function parseHttpStatusCode(message: string): number | null {
  const directMatch = message.match(/\bstatus(?:\s+code)?[:=\s]+(\d{3})\b/i);
  if (directMatch?.[1]) {
    return Number(directMatch[1]);
  }
  const httpMatch = message.match(/\bhttp\s*(\d{3})\b/i);
  if (httpMatch?.[1]) {
    return Number(httpMatch[1]);
  }
  return null;
}

export function isUpdaterCanceledError(error: unknown): boolean {
  return normalizeUpdaterErrorMessage(error).includes(UPDATE_CANCELED_ERROR_CODE);
}

export function createUpdaterCanceledError(): Error {
  return new Error(UPDATE_CANCELED_ERROR_CODE);
}

export function isRetryableUpdaterError(error: unknown): boolean {
  if (isUpdaterCanceledError(error)) {
    return false;
  }

  const raw = normalizeUpdaterErrorMessage(error).toLowerCase();
  if (!raw) {
    return false;
  }

  if (NON_RETRYABLE_HINTS.some((token) => raw.includes(token))) {
    return false;
  }

  const statusCode = parseHttpStatusCode(raw);
  if (statusCode !== null) {
    if (statusCode >= 500) {
      return true;
    }
    if (statusCode === 408 || statusCode === 429) {
      return true;
    }
    if (statusCode >= 400) {
      return false;
    }
  }

  return RETRYABLE_NETWORK_HINTS.some((token) => raw.includes(token));
}

function withJitter(delayMs: number): number {
  const jitter = Math.floor(Math.random() * 350);
  return delayMs + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const maxAttempts = Math.max(1, options.delaysMs.length + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!options.shouldRetry(error) || attempt >= maxAttempts) {
        throw error;
      }

      const retryIndex = attempt;
      const totalRetries = maxAttempts - 1;
      const delayMs = withJitter(options.delaysMs[Math.min(retryIndex - 1, options.delaysMs.length - 1)]);
      if (options.onRetry) {
        await options.onRetry({
          retryIndex,
          totalRetries,
          delayMs,
          error,
        });
      }
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error('Retry failed without explicit error');
}
