import * as codexInstanceService from '../services/windsurfInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useWindsurfInstanceStore = createInstanceStore(
  codexInstanceService,
  'agtools.windsurf.instances.cache',
);
