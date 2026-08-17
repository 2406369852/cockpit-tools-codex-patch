import * as claudeInstanceService from '../services/claudeInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useClaudeInstanceStore = createInstanceStore(
  claudeInstanceService,
  'agtools.claude.instances.cache',
);
