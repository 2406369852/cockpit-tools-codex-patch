import { invoke } from '@tauri-apps/api/core';
import type { AnnouncementState } from '../types/announcement';

export async function getAnnouncementState(): Promise<AnnouncementState> {
  return await invoke('announcement_get_state');
}

export async function markAnnouncementAsRead(id: string): Promise<void> {
  await invoke('announcement_mark_as_read', { id });
}

export async function markAllAnnouncementsAsRead(): Promise<void> {
  await invoke('announcement_mark_all_as_read');
}

export async function forceRefreshAnnouncements(): Promise<AnnouncementState> {
  return await invoke('announcement_force_refresh');
}
