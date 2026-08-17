import {
  CodebuddyAccount,
  getCodebuddyAccountDisplayEmail,
  getCodebuddyPlanBadge,
  getCodebuddyUsage,
} from '../types/codebuddy';
import * as codebuddyCnService from '../services/codebuddyCnService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const CODEBUDDY_CN_ACCOUNTS_CACHE_KEY = 'agtools.codebuddycn.accounts.cache';
const CODEBUDDY_CN_CURRENT_ACCOUNT_ID_KEY = 'agtools.codebuddycn.current_account_id';

export const useCodebuddyCnAccountStore = createProviderAccountStore<CodebuddyAccount>(
  CODEBUDDY_CN_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: codebuddyCnService.listCodebuddyCnAccounts,
    deleteAccount: codebuddyCnService.deleteCodebuddyCnAccount,
    deleteAccounts: codebuddyCnService.deleteCodebuddyCnAccounts,
    injectAccount: codebuddyCnService.injectCodebuddyCnToVSCode,
    refreshToken: codebuddyCnService.refreshCodebuddyCnToken,
    refreshAllTokens: codebuddyCnService.refreshAllCodebuddyCnTokens,
    importFromJson: codebuddyCnService.importCodebuddyCnFromJson,
    exportAccounts: codebuddyCnService.exportCodebuddyCnAccounts,
    updateAccountTags: codebuddyCnService.updateCodebuddyCnAccountTags,
  },
  {
    getDisplayEmail: getCodebuddyAccountDisplayEmail,
    getPlanBadge: getCodebuddyPlanBadge,
    getUsage: getCodebuddyUsage,
  },
  {
    platformId: 'codebuddy_cn',
    currentAccountIdKey: CODEBUDDY_CN_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('codebuddy_cn'),
  },
);
