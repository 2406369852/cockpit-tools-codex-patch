import { invoke } from '@tauri-apps/api/core';

export interface CodexSshServer {
  id: string;
  name: string;
  host: string;
  user: string;
  port: number;
  remoteCodexDir: string;
}

export interface CodexSshListResult {
  servers: CodexSshServer[];
  selectedId: string | null;
}

export async function listCodexSshServers(): Promise<CodexSshListResult> {
  return await invoke('codex_ssh_list_servers');
}

export async function upsertCodexSshServer(
  server: CodexSshServer,
): Promise<CodexSshServer> {
  return await invoke('codex_ssh_upsert_server', { server });
}

export async function deleteCodexSshServer(id: string): Promise<void> {
  return await invoke('codex_ssh_delete_server', { id });
}

export async function selectCodexSshServer(id: string): Promise<void> {
  return await invoke('codex_ssh_select_server', { id });
}

export async function testCodexSshConnection(id: string): Promise<string> {
  return await invoke('codex_ssh_test_connection', { id });
}

export async function syncCodexSshCurrent(id: string): Promise<string> {
  return await invoke('codex_ssh_sync_current', { id });
}
