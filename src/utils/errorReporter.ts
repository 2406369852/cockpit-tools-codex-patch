import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

type DiagnosticsLevel = 'info' | 'warning' | 'error' | 'fatal';

type ErrorReporterContext = {
  source?: string;
  phase?: string;
  platformId?: string;
  [key: string]: unknown;
};

type DiagnosticsPayload = {
  level: DiagnosticsLevel;
  message: string;
  name?: string;
  stack?: string;
  source?: string;
  phase?: string;
  platformId?: string;
  metadata?: Record<string, unknown>;
};

const MAX_STRING_LENGTH = 2000;
const MAX_CONTEXT_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 50;

let initialized = false;
let appVersion: string | null = null;

function truncateText(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || 'Error';
  }
  if (typeof error === 'string') {
    return error.trim() || 'Error';
  }
  if (error == null) {
    return 'Error';
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function normalizeErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return 'Error';
}

function normalizeErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return truncateText(error.stack);
  }
  return undefined;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('password') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('authorization') ||
    normalized.includes('api_key') ||
    normalized.includes('apikey') ||
    normalized.includes('two_factor') ||
    normalized.includes('2fa') ||
    normalized.includes('phone') ||
    normalized.includes('email')
  );
}

function normalizeMetadataValue(value: unknown, depth: number, key?: string): unknown {
  if (key && isSensitiveKey(key)) {
    return '[redacted]';
  }
  if (typeof value === 'string') {
    return truncateText(value);
  }
  if (
    value == null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (depth >= MAX_CONTEXT_DEPTH) {
    if (Array.isArray(value)) return `array(${value.length})`;
    if (typeof value === 'object') return 'object';
    return typeof value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => normalizeMetadataValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
      result[childKey] = normalizeMetadataValue(childValue, depth + 1, childKey);
    }
    return result;
  }
  return String(value);
}

function normalizeContext(context?: ErrorReporterContext): {
  source?: string;
  phase?: string;
  platformId?: string;
  metadata: Record<string, unknown>;
} {
  const metadata: Record<string, unknown> = {
    appVersion: appVersion ?? 'unknown',
    urlPath: window.location.pathname,
    visibility: document.visibilityState,
  };
  if (!context) {
    return { metadata };
  }

  const { source, phase, platformId, ...rest } = context;
  for (const [key, value] of Object.entries(rest)) {
    metadata[key] = normalizeMetadataValue(value, 0, key);
  }
  return {
    source,
    phase,
    platformId,
    metadata,
  };
}

function sendDiagnosticsEvent(payload: DiagnosticsPayload): void {
  void invoke('diagnostics_capture_event', { event: payload }).catch(() => {
    // Error reporting must never affect the user flow.
  });
}

export function captureError(error: unknown, context?: ErrorReporterContext): void {
  const normalizedContext = normalizeContext(context);
  sendDiagnosticsEvent({
    level: 'error',
    message: truncateText(normalizeErrorMessage(error)),
    name: normalizeErrorName(error),
    stack: normalizeErrorStack(error),
    source: normalizedContext.source,
    phase: normalizedContext.phase,
    platformId: normalizedContext.platformId,
    metadata: normalizedContext.metadata,
  });
}

export function captureMessage(
  message: string,
  level: DiagnosticsLevel = 'info',
  context?: ErrorReporterContext,
): void {
  const normalizedContext = normalizeContext(context);
  sendDiagnosticsEvent({
    level,
    message: truncateText(message),
    source: normalizedContext.source,
    phase: normalizedContext.phase,
    platformId: normalizedContext.platformId,
    metadata: normalizedContext.metadata,
  });
}

export function recordFrontendStage(stage: string, detail?: Record<string, unknown>): void {
  const normalizedDetail = detail
    ? normalizeMetadataValue(detail, 0) as Record<string, unknown>
    : undefined;
  void invoke('diagnostics_frontend_stage', {
    stage,
    detail: normalizedDetail ?? null,
  }).catch(() => {});
}

export function markFrontendReady(stage = 'react_mounted'): void {
  void invoke('diagnostics_frontend_ready', { stage }).catch(() => {});
}

export function initErrorReporter(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  void getVersion()
    .then((version) => {
      appVersion = version;
    })
    .catch(() => {
      appVersion = 'unknown';
    });

  window.addEventListener('error', (event) => {
    captureError(event.error || event.message, {
      source: 'window_error',
      phase: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, {
      source: 'window_error',
      phase: 'unhandled_rejection',
    });
  });
}
