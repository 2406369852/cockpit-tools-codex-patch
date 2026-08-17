import type { Account, ModelQuota, QuotaData } from '../types/account';

export interface AntigravityModelOption {
  id: string;
  displayName: string;
  modelConstant?: string | null;
  recommended?: boolean | null;
}

interface ModelIdentity {
  id?: string | null;
  modelConstant?: string | null;
  displayName?: string | null;
}

interface CanonicalModel {
  id: string;
  displayName: string;
  modelConstant: string;
  aliases: string[];
}

const CANONICAL_MODELS: CanonicalModel[] = [
  {
    id: 'gemini-3.1-pro-high',
    displayName: 'Gemini 3.1 Pro (High)',
    modelConstant: 'MODEL_PLACEHOLDER_M37',
    aliases: ['gemini-3-pro-high', 'MODEL_PLACEHOLDER_M8'],
  },
  {
    id: 'gemini-3.1-pro-low',
    displayName: 'Gemini 3.1 Pro (Low)',
    modelConstant: 'MODEL_PLACEHOLDER_M36',
    aliases: ['gemini-3-pro-low', 'MODEL_PLACEHOLDER_M7'],
  },
  {
    id: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    modelConstant: 'MODEL_PLACEHOLDER_M18',
    aliases: [],
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Thinking)',
    modelConstant: 'MODEL_PLACEHOLDER_M35',
    aliases: ['claude-sonnet-4-6-thinking', 'claude-sonnet-4-5', 'claude-sonnet-4-5-thinking'],
  },
  {
    id: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 (Thinking)',
    modelConstant: 'MODEL_PLACEHOLDER_M26',
    aliases: ['claude-opus-4-6', 'claude-opus-4-5-thinking', 'MODEL_PLACEHOLDER_M12'],
  },
  {
    id: 'gpt-oss-120b-medium',
    displayName: 'GPT-OSS 120B (Medium)',
    modelConstant: 'MODEL_OPENAI_GPT_OSS_120B_MEDIUM',
    aliases: [],
  },
];

export const AUTH_RECOMMENDED_LABELS = CANONICAL_MODELS.map((item) => item.displayName);
export const AUTH_RECOMMENDED_MODEL_IDS = CANONICAL_MODELS.map((item) => item.modelConstant);

const normalize = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const buildAliasMap = () => {
  const map = new Map<string, CanonicalModel>();
  CANONICAL_MODELS.forEach((item) => {
    [item.id, item.modelConstant, item.displayName, ...item.aliases].forEach((value) => {
      const key = normalize(value);
      if (!key || map.has(key)) return;
      map.set(key, item);
    });
  });
  return map;
};

const CANONICAL_BY_ALIAS = buildAliasMap();
const CANONICAL_RANK = new Map<string, number>(
  CANONICAL_MODELS.map((item, index) => [item.id, index]),
);

const resolveCanonicalModel = (identity: ModelIdentity): CanonicalModel | undefined => {
  const keys = [identity.id, identity.modelConstant, identity.displayName]
    .map((value) => normalize(value))
    .filter((value) => value.length > 0);
  for (const key of keys) {
    const found = CANONICAL_BY_ALIAS.get(key);
    if (found) return found;
  }
  return undefined;
};

export const getAntigravityModelDisplayName = (value: string): string => {
  const found = resolveCanonicalModel({ id: value, modelConstant: value, displayName: value });
  return found?.displayName || value;
};

export const filterAntigravityModelOptions = (
  models: AntigravityModelOption[],
  _options?: {
    allowedModelKeys?: Iterable<string>;
    includeNonRecommended?: boolean;
  },
): AntigravityModelOption[] => {
  if (!Array.isArray(models) || models.length === 0) {
    return [];
  }

  const result: AntigravityModelOption[] = [];
  const seen = new Set<string>();

  models.forEach((model) => {
    const canonical = resolveCanonicalModel({
      id: model.id,
      modelConstant: model.modelConstant,
      displayName: model.displayName,
    });
    if (!canonical) return;
    if (seen.has(canonical.id)) return;
    seen.add(canonical.id);
    result.push({
      id: canonical.id,
      displayName: (model.displayName || '').trim() || canonical.displayName,
      modelConstant: model.modelConstant || canonical.modelConstant,
      recommended: true,
    });
  });

  return result;
};

export const collectAntigravityQuotaModelKeys = (accounts: Account[]): string[] => {
  const keys: string[] = [];
  const seen = new Set<string>();
  accounts.forEach((account) => {
    (account.quota?.models || []).forEach((model) => {
      const key = normalize(model.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      keys.push(model.name);
    });
  });
  return keys;
};

export const buildAntigravityFallbackModelOptions = (_accounts: Account[]): AntigravityModelOption[] =>
  [];

export const sortAntigravityQuotaModels = (models: ModelQuota[]): ModelQuota[] => {
  if (!Array.isArray(models) || models.length === 0) {
    return [];
  }

  const picked: Array<{ rank: number; model: ModelQuota }> = [];
  const seen = new Set<string>();

  models.forEach((model) => {
    const canonical = resolveCanonicalModel({
      id: model.name,
      modelConstant: model.name,
      displayName: model.display_name || model.name,
    });
    if (!canonical) return;
    if (seen.has(canonical.id)) return;
    seen.add(canonical.id);
    picked.push({
      rank: CANONICAL_RANK.get(canonical.id) ?? Number.MAX_SAFE_INTEGER,
      model,
    });
  });

  return picked
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.model);
};

export const getAntigravityDisplayModelsFromQuota = (quota?: QuotaData): ModelQuota[] => {
  if (!quota?.models?.length) {
    return [];
  }
  return sortAntigravityQuotaModels(quota.models);
};
