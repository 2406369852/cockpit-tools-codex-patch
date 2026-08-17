import * as qoderInstanceService from '../services/qoderInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useQoderInstanceStore = createInstanceStore(
  qoderInstanceService,
  'agtools.qoder.instances.cache',
);
