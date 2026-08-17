import { create } from 'zustand';
import type { AnnouncementState } from '../types/announcement';
import {
  forceRefreshAnnouncements,
  getAnnouncementState,
  markAllAnnouncementsAsRead,
  markAnnouncementAsRead,
} from '../services/announcementService';

const EMPTY_STATE: AnnouncementState = {
  announcements: [],
  unreadIds: [],
  popupAnnouncement: null,
};

interface AnnouncementStoreState {
  state: AnnouncementState;
  loading: boolean;
  initialized: boolean;
  fetchState: (forceRefresh?: boolean) => Promise<AnnouncementState>;
  markAsRead: (id: string) => Promise<AnnouncementState>;
  markAllAsRead: () => Promise<AnnouncementState>;
}

export const useAnnouncementStore = create<AnnouncementStoreState>((set) => ({
  state: EMPTY_STATE,
  loading: false,
  initialized: false,

  fetchState: async (forceRefresh = false) => {
    set({ loading: true });
    try {
      const nextState = forceRefresh
        ? await forceRefreshAnnouncements()
        : await getAnnouncementState();
      set({ state: nextState, loading: false, initialized: true });
      return nextState;
    } catch (error) {
      console.error('加载公告失败:', error);
      set({ loading: false, initialized: true });
      return EMPTY_STATE;
    }
  },

  markAsRead: async (id: string) => {
    try {
      await markAnnouncementAsRead(id);
    } catch (error) {
      console.error('标记公告已读失败:', error);
    }

    const nextState = await getAnnouncementState().catch((error) => {
      console.error('刷新公告状态失败:', error);
      return EMPTY_STATE;
    });
    set({ state: nextState });
    return nextState;
  },

  markAllAsRead: async () => {
    try {
      await markAllAnnouncementsAsRead();
    } catch (error) {
      console.error('全部标记公告已读失败:', error);
    }

    const nextState = await getAnnouncementState().catch((error) => {
      console.error('刷新公告状态失败:', error);
      return EMPTY_STATE;
    });
    set({ state: nextState });
    return nextState;
  },
}));
