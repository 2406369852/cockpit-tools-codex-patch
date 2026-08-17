import { invoke } from '@tauri-apps/api/core';
import { ZedAccount, ZedOAuthStartResponse, ZedRuntimeStatus } from '../types/zed';

type ZedOAuthStartResponseRaw = Partial<ZedOAuthStartResponse> & {
  login_id?: string;
  verification_uri?: string;
  expires_in?: number;
  interval_seconds?: number;
  callback_url?: string | null;
};

function normalizeZedOAuthStartResponse(raw: ZedOAuthStartResponseRaw): ZedOAuthStartResponse {
  const loginId = raw.loginId ?? raw.login_id ?? '';
  const verificationUri = raw.verificationUri ?? raw.verification_uri ?? '';
  const expiresIn = Number(raw.expiresIn ?? raw.expires_in ?? 0);
  const intervalSeconds = Number(raw.intervalSeconds ?? raw.interval_seconds ?? 0);
  const callbackUrl = raw.callbackUrl ?? raw.callback_url ?? null;

  if (!loginId || !verificationUri) {
    throw new Error('Zed OAuth start 响应缺少关键字段');
  }

  return {
    loginId,
    verificationUri,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 600,
    intervalSeconds: Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 1,
    callbackUrl,
  };
}

export async function listZedAccounts(): Promise<ZedAccount[]> {
  return await invoke('list_zed_accounts');
}

export async function deleteZedAccount(accountId: string): Promise<void> {
  return await invoke('delete_zed_account', { accountId });
}

export async function deleteZedAccounts(accountIds: string[]): Promise<void> {
  return await invoke('delete_zed_accounts', { accountIds });
}

export async function importZedFromJson(jsonContent: string): Promise<ZedAccount[]> {
  return await invoke('import_zed_from_json', { jsonContent });
}

export async function importZedFromLocal(): Promise<ZedAccount[]> {
  return await invoke('import_zed_from_local');
}

export async function exportZedAccounts(accountIds: string[]): Promise<string> {
  return await invoke('export_zed_accounts', { accountIds });
}

export async function refreshZedToken(accountId: string): Promise<ZedAccount> {
  return await invoke('refresh_zed_token', { accountId });
}

export async function refreshAllZedTokens(): Promise<number> {
  return await invoke('refresh_all_zed_tokens');
}

export async function injectZedAccount(accountId: string): Promise<string> {
  return await invoke('inject_zed_account', { accountId });
}

export async function updateZedAccountTags(accountId: string, tags: string[]): Promise<ZedAccount> {
  return await invoke('update_zed_account_tags', { accountId, tags });
}

export async function zedOauthLoginStart(): Promise<ZedOAuthStartResponse> {
  const raw = await invoke<ZedOAuthStartResponseRaw>('zed_oauth_login_start');
  return normalizeZedOAuthStartResponse(raw);
}

export async function zedOauthLoginPeek(): Promise<ZedOAuthStartResponse | null> {
  const raw = await invoke<ZedOAuthStartResponseRaw | null>('zed_oauth_login_peek');
  if (!raw) return null;
  try {
    return normalizeZedOAuthStartResponse(raw);
  } catch {
    return null;
  }
}

export async function zedOauthLoginComplete(loginId: string): Promise<ZedAccount> {
  return await invoke('zed_oauth_login_complete', { loginId });
}

export async function zedOauthLoginCancel(loginId?: string): Promise<void> {
  return await invoke('zed_oauth_login_cancel', { loginId: loginId ?? null });
}

export async function zedOauthSubmitCallbackUrl(loginId: string, callbackUrl: string): Promise<void> {
  return await invoke('zed_oauth_submit_callback_url', { loginId, callbackUrl });
}

export async function zedLogoutCurrentAccount(): Promise<string> {
  return await invoke('zed_logout_current_account');
}

export async function getZedRuntimeStatus(): Promise<ZedRuntimeStatus> {
  return await invoke('zed_get_runtime_status');
}

export async function startZedDefaultSession(): Promise<ZedRuntimeStatus> {
  return await invoke('zed_start_default_session');
}

export async function stopZedDefaultSession(): Promise<ZedRuntimeStatus> {
  return await invoke('zed_stop_default_session');
}

export async function restartZedDefaultSession(): Promise<ZedRuntimeStatus> {
  return await invoke('zed_restart_default_session');
}

export async function focusZedDefaultSession(): Promise<ZedRuntimeStatus> {
  return await invoke('zed_focus_default_session');
}
