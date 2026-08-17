import {
  ClaudeAccount,
  getClaudeAccountDisplayEmail,
  getClaudePlanBadge,
  getClaudeUsage,
} from '../types/claude';
import * as claudeService from '../services/claudeService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const CLAUDE_ACCOUNTS_CACHE_KEY = 'agtools.claude.accounts.cache.v2';
const CLAUDE_CURRENT_ACCOUNT_ID_KEY = 'agtools.claude.current_account_id';

export const useClaudeAccountStore = createProviderAccountStore<ClaudeAccount>(
  CLAUDE_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: claudeService.listClaudeAccounts,
    deleteAccount: claudeService.deleteClaudeAccount,
    deleteAccounts: claudeService.deleteClaudeAccounts,
    injectAccount: claudeService.switchClaudeAccount,
    refreshToken: claudeService.refreshClaudeQuota,
    refreshAllTokens: claudeService.refreshAllClaudeQuotas,
    importFromJson: claudeService.importClaudeFromJson,
    exportAccounts: claudeService.exportClaudeAccounts,
    updateAccountTags: claudeService.updateClaudeAccountTags,
  },
  {
    getDisplayEmail: getClaudeAccountDisplayEmail,
    getPlanBadge: getClaudePlanBadge,
    getUsage: (account) => {
      const usage = getClaudeUsage(account);
      return {
        inlineSuggestionsUsedPercent: usage.fiveHourPercentUsed,
        chatMessagesUsedPercent: usage.sevenDayPercentUsed,
      };
    },
  },
  {
    platformId: 'claude_manager',
    currentAccountIdKey: CLAUDE_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('claude_desktop_account'),
    preserveSourceQuota: true,
  },
);
