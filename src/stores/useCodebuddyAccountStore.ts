import {
  CodebuddyAccount,
  getCodebuddyAccountDisplayEmail,
  getCodebuddyPlanBadge,
  getCodebuddyUsage,
} from '../types/codebuddy';
import * as codebuddyService from '../services/codebuddyService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const CODEBUDDY_ACCOUNTS_CACHE_KEY = 'agtools.codebuddy.accounts.cache';
const CODEBUDDY_CURRENT_ACCOUNT_ID_KEY = 'agtools.codebuddy.current_account_id';

export const useCodebuddyAccountStore = createProviderAccountStore<CodebuddyAccount>(
  CODEBUDDY_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: codebuddyService.listCodebuddyAccounts,
    deleteAccount: codebuddyService.deleteCodebuddyAccount,
    deleteAccounts: codebuddyService.deleteCodebuddyAccounts,
    injectAccount: codebuddyService.injectCodebuddyToVSCode,
    refreshToken: codebuddyService.refreshCodebuddyToken,
    refreshAllTokens: codebuddyService.refreshAllCodebuddyTokens,
    importFromJson: codebuddyService.importCodebuddyFromJson,
    exportAccounts: codebuddyService.exportCodebuddyAccounts,
    updateAccountTags: codebuddyService.updateCodebuddyAccountTags,
  },
  {
    getDisplayEmail: getCodebuddyAccountDisplayEmail,
    getPlanBadge: getCodebuddyPlanBadge,
    getUsage: getCodebuddyUsage,
  },
  {
    platformId: 'codebuddy',
    currentAccountIdKey: CODEBUDDY_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('codebuddy'),
  },
);
