import {
  WorkbuddyAccount,
  getWorkbuddyAccountDisplayEmail,
  getWorkbuddyPlanBadge,
  getWorkbuddyUsage,
} from '../types/workbuddy';
import * as workbuddyService from '../services/workbuddyService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const WORKBUDDY_ACCOUNTS_CACHE_KEY = 'agtools.workbuddy.accounts.cache';
const WORKBUDDY_CURRENT_ACCOUNT_ID_KEY = 'agtools.workbuddy.current_account_id';

export const useWorkbuddyAccountStore = createProviderAccountStore<WorkbuddyAccount>(
  WORKBUDDY_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: workbuddyService.listWorkbuddyAccounts,
    deleteAccount: workbuddyService.deleteWorkbuddyAccount,
    deleteAccounts: workbuddyService.deleteWorkbuddyAccounts,
    injectAccount: workbuddyService.injectWorkbuddyToVSCode,
    refreshToken: workbuddyService.refreshWorkbuddyToken,
    refreshAllTokens: workbuddyService.refreshAllWorkbuddyTokens,
    importFromJson: workbuddyService.importWorkbuddyFromJson,
    exportAccounts: workbuddyService.exportWorkbuddyAccounts,
    updateAccountTags: workbuddyService.updateWorkbuddyAccountTags,
  },
  {
    getDisplayEmail: getWorkbuddyAccountDisplayEmail,
    getPlanBadge: getWorkbuddyPlanBadge,
    getUsage: getWorkbuddyUsage,
  },
  {
    platformId: 'workbuddy',
    currentAccountIdKey: WORKBUDDY_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('workbuddy'),
  },
);
