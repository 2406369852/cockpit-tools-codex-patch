import {
  GitHubCopilotAccount,
  getGitHubCopilotAccountDisplayEmail,
  getGitHubCopilotPlanBadge,
  getGitHubCopilotUsage,
} from '../types/githubCopilot';
import * as githubCopilotService from '../services/githubCopilotService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const GHCP_ACCOUNTS_CACHE_KEY = 'agtools.github_copilot.accounts.cache';
const GHCP_CURRENT_ACCOUNT_ID_KEY = 'agtools.github_copilot.current_account_id';

export const useGitHubCopilotAccountStore = createProviderAccountStore<GitHubCopilotAccount>(
  GHCP_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: githubCopilotService.listGitHubCopilotAccounts,
    deleteAccount: githubCopilotService.deleteGitHubCopilotAccount,
    deleteAccounts: githubCopilotService.deleteGitHubCopilotAccounts,
    injectAccount: githubCopilotService.injectGitHubCopilotToVSCode,
    refreshToken: githubCopilotService.refreshGitHubCopilotToken,
    refreshAllTokens: githubCopilotService.refreshAllGitHubCopilotTokens,
    importFromJson: githubCopilotService.importGitHubCopilotFromJson,
    exportAccounts: githubCopilotService.exportGitHubCopilotAccounts,
    updateAccountTags: githubCopilotService.updateGitHubCopilotAccountTags,
  },
  {
    getDisplayEmail: getGitHubCopilotAccountDisplayEmail,
    getPlanBadge: getGitHubCopilotPlanBadge,
    getUsage: getGitHubCopilotUsage,
  },
  {
    platformId: 'github-copilot',
    currentAccountIdKey: GHCP_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('github_copilot'),
  },
);
