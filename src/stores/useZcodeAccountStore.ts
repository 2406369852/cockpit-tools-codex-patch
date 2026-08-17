import { createProviderAccountStore } from './createProviderAccountStore';
import * as zcodeService from '../services/zcodeService';
import {
  getZcodeAccountDisplayEmail,
  getZcodePlanBadge,
  getZcodeUsage,
  type ZcodeAccount,
} from '../types/zcode';

export const useZcodeAccountStore = createProviderAccountStore<ZcodeAccount>(
  'agtools.zcode.accounts.cache',
  {
    listAccounts: zcodeService.listZcodeAccounts,
    deleteAccount: zcodeService.deleteZcodeAccount,
    deleteAccounts: zcodeService.deleteZcodeAccounts,
    injectAccount: zcodeService.injectZcodeAccount,
    refreshToken: zcodeService.refreshZcodeAccount,
    refreshAllTokens: zcodeService.refreshAllZcodeAccounts,
    importFromJson: zcodeService.importZcodeFromJson,
    exportAccounts: zcodeService.exportZcodeAccounts,
    updateAccountTags: zcodeService.updateZcodeAccountTags,
  },
  {
    getDisplayEmail: getZcodeAccountDisplayEmail,
    getPlanBadge: getZcodePlanBadge,
    getUsage: getZcodeUsage,
  },
  {
    platformId: 'zcode',
    currentAccountIdKey: 'agtools.zcode.current_account_id',
    resolveCurrentAccountId: zcodeService.getZcodeCurrentAccountId,
  },
);
