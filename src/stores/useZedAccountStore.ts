import {
  ZedAccount,
  getZedAccountDisplayEmail,
  getZedPlanBadge,
  getZedUsage,
} from '../types/zed';
import * as zedService from '../services/zedService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const ZED_ACCOUNTS_CACHE_KEY = 'agtools.zed.accounts.cache';
const ZED_CURRENT_ACCOUNT_ID_KEY = 'agtools.zed.current_account_id';

export const useZedAccountStore = createProviderAccountStore<ZedAccount>(
  ZED_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: zedService.listZedAccounts,
    deleteAccount: zedService.deleteZedAccount,
    deleteAccounts: zedService.deleteZedAccounts,
    injectAccount: zedService.injectZedAccount,
    refreshToken: zedService.refreshZedToken,
    refreshAllTokens: zedService.refreshAllZedTokens,
    importFromJson: zedService.importZedFromJson,
    exportAccounts: zedService.exportZedAccounts,
    updateAccountTags: zedService.updateZedAccountTags,
  },
  {
    getDisplayEmail: getZedAccountDisplayEmail,
    getPlanBadge: getZedPlanBadge,
    getUsage: getZedUsage,
  },
  {
    platformId: 'zed',
    currentAccountIdKey: ZED_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('zed'),
  },
);
