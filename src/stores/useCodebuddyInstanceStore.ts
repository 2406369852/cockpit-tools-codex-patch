import * as codebuddyInstanceService from '../services/codebuddyInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useCodebuddyInstanceStore = createInstanceStore(
  codebuddyInstanceService,
  'agtools.codebuddy.instances.cache',
);
