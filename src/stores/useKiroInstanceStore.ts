import * as kiroInstanceService from '../services/kiroInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useKiroInstanceStore = createInstanceStore(
  kiroInstanceService,
  'agtools.kiro.instances.cache',
);
