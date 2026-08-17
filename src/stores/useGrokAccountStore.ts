import { createProviderAccountStore } from './createProviderAccountStore';
import * as grokService from '../services/grokService';
import {
  getGrokAccountDisplayEmail,
  getGrokPlanBadge,
  getGrokUsage,
  type GrokAccount,
} from '../types/grok';

export const useGrokAccountStore = createProviderAccountStore<GrokAccount>(
  'agtools.grok.accounts.cache',
  {
    listAccounts: grokService.listGrokAccounts,
    deleteAccount: grokService.deleteGrokAccount,
    deleteAccounts: grokService.deleteGrokAccounts,
    injectAccount: grokService.switchGrokAccount,
    refreshToken: grokService.refreshGrokAccount,
    refreshAllTokens: grokService.refreshAllGrokAccounts,
    importFromJson: grokService.importGrokFromJson,
    exportAccounts: grokService.exportGrokAccounts,
    updateAccountTags: grokService.updateGrokAccountTags,
  },
  {
    getDisplayEmail: getGrokAccountDisplayEmail,
    getPlanBadge: getGrokPlanBadge,
    getUsage: getGrokUsage,
  },
  {
    platformId: 'grok',
    // 仅在开启「切号同步官方登录」时后端会返回当前账号；关闭时为 null。
    currentAccountIdKey: 'agtools.grok.current_account_id',
    resolveCurrentAccountId: grokService.getGrokCurrentAccountId,
    acceptEmptyCurrentAccountId: true,
    preserveSourceQuota: true,
  },
);

// 开关「切号同步官方登录」变化后立即重算是否展示「当前」标识。
if (typeof window !== 'undefined') {
  window.addEventListener('config-updated', () => {
    void useGrokAccountStore.getState().fetchCurrentAccountId();
  });
}
