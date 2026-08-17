import * as instanceService from '../services/instanceService';
import { createInstanceStore } from './createInstanceStore';

export const useInstanceStore = createInstanceStore(instanceService, 'agtools.instances.cache');
