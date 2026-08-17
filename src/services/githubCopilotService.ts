import { invoke } from '@tauri-apps/api/core';
import { GitHubCopilotAccount } from '../types/githubCopilot';

export interface GitHubCopilotOAuthLoginStartResponse {
  loginId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string | null;
  expiresIn: number;
  intervalSeconds: number;
}

/** 列出所有 GitHub Copilot 账号 */
export async function listGitHubCopilotAccounts(): Promise<GitHubCopilotAccount[]> {
  return await invoke('list_github_copilot_accounts');
}

/** 删除 GitHub Copilot 账号 */
export async function deleteGitHubCopilotAccount(accountId: string): Promise<void> {
  return await invoke('delete_github_copilot_account', { accountId });
}

/** 批量删除 GitHub Copilot 账号 */
export async function deleteGitHubCopilotAccounts(accountIds: string[]): Promise<void> {
  return await invoke('delete_github_copilot_accounts', { accountIds });
}

/** 从 JSON 字符串导入账号 */
export async function importGitHubCopilotFromJson(jsonContent: string): Promise<GitHubCopilotAccount[]> {
  return await invoke('import_github_copilot_from_json', { jsonContent });
}

/** 从本机 VS Code 导入当前 GitHub Copilot 登录账号 */
export async function importGitHubCopilotFromLocal(): Promise<GitHubCopilotAccount[]> {
  return await invoke('import_github_copilot_from_local');
}

/** 导出 GitHub Copilot 账号 */
export async function exportGitHubCopilotAccounts(accountIds: string[]): Promise<string> {
  return await invoke('export_github_copilot_accounts', { accountIds });
}

/** 刷新单个账号 token/usage */
export async function refreshGitHubCopilotToken(accountId: string): Promise<GitHubCopilotAccount> {
  return await invoke('refresh_github_copilot_token', { accountId });
}

/** 刷新全部账号 token/usage */
export async function refreshAllGitHubCopilotTokens(): Promise<number> {
  return await invoke('refresh_all_github_copilot_tokens');
}

/** VS Code GitHub Authentication OAuth：开始登录 */
export async function startGitHubCopilotOAuthLogin(): Promise<GitHubCopilotOAuthLoginStartResponse> {
  return await invoke('github_copilot_oauth_login_start');
}

/** VS Code GitHub Authentication OAuth：完成登录（等待本地回调后保存账号） */
export async function completeGitHubCopilotOAuthLogin(loginId: string): Promise<GitHubCopilotAccount> {
  return await invoke('github_copilot_oauth_login_complete', { loginId });
}

/** VS Code GitHub Authentication OAuth：取消登录 */
export async function cancelGitHubCopilotOAuthLogin(loginId?: string): Promise<void> {
  return await invoke('github_copilot_oauth_login_cancel', { loginId: loginId ?? null });
}

/** 通过 GitHub access token 添加账号 */
export async function addGitHubCopilotAccountWithToken(githubAccessToken: string): Promise<GitHubCopilotAccount> {
  return await invoke('add_github_copilot_account_with_token', { githubAccessToken });
}

export async function updateGitHubCopilotAccountTags(accountId: string, tags: string[]): Promise<GitHubCopilotAccount> {
  return await invoke('update_github_copilot_account_tags', { accountId, tags });
}

export async function getGitHubCopilotAccountsIndexPath(): Promise<string> {
  return await invoke('get_github_copilot_accounts_index_path');
}

/** Inject a Copilot account's token into VS Code's default instance */
export async function injectGitHubCopilotToVSCode(accountId: string): Promise<string> {
  return await invoke('inject_github_copilot_to_vscode', { accountId });
}
