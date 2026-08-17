import type { CodexAccount } from "../types/codex";

export interface CodexModelProviderReference {
  id: string;
  baseUrl: string;
}

function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return null;
  }
}

export function findCodexAccountsReferencingModelProvider(
  provider: CodexModelProviderReference,
  accounts: CodexAccount[],
): string[] {
  const providerId = provider.id.trim();
  const providerBaseUrl = normalizeBaseUrl(provider.baseUrl);

  return accounts
    .filter((account) => {
      if ((account.auth_mode ?? "").toLowerCase() !== "apikey") return false;
      if (!account.openai_api_key?.trim()) return false;

      const matchesId =
        providerId.length > 0 && account.api_provider_id?.trim() === providerId;
      const accountBaseUrl = normalizeBaseUrl(account.api_base_url);
      const matchesBaseUrl =
        providerBaseUrl !== null && accountBaseUrl === providerBaseUrl;
      return matchesId || matchesBaseUrl;
    })
    .map((account) => account.id);
}
