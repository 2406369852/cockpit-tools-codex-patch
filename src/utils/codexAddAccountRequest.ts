export const CODEX_OPEN_ADD_ACCOUNT_EVENT = 'codex-open-add-account';
export const CODEX_SUITE_ENSURE_MOUNTED_EVENT = 'codex-suite-ensure-mounted';

export type CodexAddAccountTab = 'oauth' | 'token' | 'apikey' | 'import';

export type CodexOpenAddAccountDetail = {
  autoJoinApiService?: boolean;
  tab?: CodexAddAccountTab;
};

/** Ask Codex suite pages to stay mounted and open the shared add-account modal. */
export function requestCodexOpenAddAccount(
  detail: CodexOpenAddAccountDetail = {},
): void {
  const autoJoinApiService = detail.autoJoinApiService === true;
  const tab = detail.tab ?? 'oauth';
  window.dispatchEvent(new CustomEvent(CODEX_SUITE_ENSURE_MOUNTED_EVENT));
  window.dispatchEvent(
    new CustomEvent(CODEX_OPEN_ADD_ACCOUNT_EVENT, {
      detail: { autoJoinApiService, tab } satisfies CodexOpenAddAccountDetail,
    }),
  );
}
