import * as codebuddyCnInstanceService from '../services/codebuddyCnInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useCodebuddyCnInstanceStore = createInstanceStore(
  codebuddyCnInstanceService,
  'agtools.codebuddycn.instances.cache',
);
