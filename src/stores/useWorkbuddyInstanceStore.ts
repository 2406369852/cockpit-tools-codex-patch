import * as workbuddyInstanceService from '../services/workbuddyInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useWorkbuddyInstanceStore = createInstanceStore(
  workbuddyInstanceService,
  'agtools.workbuddy.instances.cache',
);
