export interface CodexApiServiceCompatibilityBaseUrls {
  openai: string;
  root: string;
  gemini: string;
}

export function resolveCodexApiServiceCompatibilityBaseUrls(
  serviceBaseUrl: string,
): CodexApiServiceCompatibilityBaseUrls {
  const normalized = serviceBaseUrl.trim().replace(/\/+$/, "");
  const root = /\/v1$/i.test(normalized)
    ? normalized.slice(0, -"/v1".length)
    : normalized;

  return {
    openai: /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`,
    root,
    gemini: `${root}/v1beta`,
  };
}
