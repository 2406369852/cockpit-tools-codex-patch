import * as zcodeInstanceService from '../services/zcodeInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useZcodeInstanceStore = createInstanceStore(
  zcodeInstanceService,
  'agtools.zcode.instances.cache',
);
