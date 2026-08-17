import * as codexInstanceService from '../services/githubCopilotInstanceService';
import { createInstanceStore } from './createInstanceStore';

export const useGitHubCopilotInstanceStore = createInstanceStore(
  codexInstanceService,
  'agtools.github_copilot.instances.cache',
);
