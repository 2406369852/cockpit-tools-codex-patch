import * as antigravityLegacyInstanceService from '../services/antigravityLegacyInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useAntigravityLegacyInstanceStore = createInstanceStore(
  antigravityLegacyInstanceService,
  'agtools.antigravity_legacy.instances.cache',
);
