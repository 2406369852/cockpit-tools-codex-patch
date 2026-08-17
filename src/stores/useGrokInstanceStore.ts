import * as grokInstanceService from '../services/grokInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useGrokInstanceStore = createInstanceStore(
  grokInstanceService,
  'agtools.grok.instances.cache',
);
