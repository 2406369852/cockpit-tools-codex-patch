import {
  KiroAccount,
  getKiroAccountDisplayEmail,
  getKiroPlanBadge,
  getKiroUsage,
} from '../types/kiro';
import * as kiroService from '../services/kiroService';
import { getProviderCurrentAccountId } from '../services/providerCurrentAccountService';
import { createProviderAccountStore } from './createProviderAccountStore';

const KIRO_ACCOUNTS_CACHE_KEY = 'agtools.kiro.accounts.cache';
const KIRO_CURRENT_ACCOUNT_ID_KEY = 'agtools.kiro.current_account_id';

export const useKiroAccountStore = createProviderAccountStore<KiroAccount>(
  KIRO_ACCOUNTS_CACHE_KEY,
  {
    listAccounts: kiroService.listKiroAccounts,
    deleteAccount: kiroService.deleteKiroAccount,
    deleteAccounts: kiroService.deleteKiroAccounts,
    injectAccount: kiroService.injectKiroToVSCode,
    refreshToken: kiroService.refreshKiroToken,
    refreshAllTokens: kiroService.refreshAllKiroTokens,
    importFromJson: kiroService.importKiroFromJson,
    exportAccounts: kiroService.exportKiroAccounts,
    updateAccountTags: kiroService.updateKiroAccountTags,
  },
  {
    getDisplayEmail: getKiroAccountDisplayEmail,
    getPlanBadge: getKiroPlanBadge,
    getUsage: getKiroUsage,
  },
  {
    platformId: 'kiro',
    currentAccountIdKey: KIRO_CURRENT_ACCOUNT_ID_KEY,
    resolveCurrentAccountId: () => getProviderCurrentAccountId('kiro'),
  },
);
