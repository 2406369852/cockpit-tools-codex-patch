import * as cursorInstanceService from '../services/cursorInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useCursorInstanceStore = createInstanceStore(
  cursorInstanceService,
  'agtools.cursor.instances.cache',
);
