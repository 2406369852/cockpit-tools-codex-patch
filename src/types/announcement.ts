export type AnnouncementType = 'feature' | 'warning' | 'info' | 'urgent';

export type AnnouncementActionType = 'tab' | 'url' | 'command';

export interface AnnouncementAction {
  type: AnnouncementActionType;
  target: string;
  label: string;
  arguments?: unknown[];
}

export interface AnnouncementImage {
  url: string;
  label?: string;
  alt?: string;
}

export interface Announcement {
  id: string;
  type: AnnouncementType | string;
  priority: number;
  title: string;
  summary: string;
  content: string;
  action?: AnnouncementAction | null;
  targetVersions: string;
  targetLanguages?: string[];
  showOnce?: boolean;
  popup: boolean;
  createdAt: string;
  expiresAt?: string | null;
  images?: AnnouncementImage[];
}

export interface AnnouncementState {
  announcements: Announcement[];
  unreadIds: string[];
  popupAnnouncement: Announcement | null;
}
