import { ReactNode } from 'react';
import { create } from 'zustand';

export type GlobalModalActionVariant = 'primary' | 'secondary' | 'danger';

export interface GlobalModalAction {
  id?: string;
  label: string;
  variant?: GlobalModalActionVariant;
  onClick?: () => void | Promise<void>;
  autoClose?: boolean;
  disabled?: boolean;
}

export interface GlobalModalOptions {
  title: string;
  description?: string;
  content?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
  actions?: GlobalModalAction[];
}

interface GlobalModalState {
  visible: boolean;
  modal: GlobalModalOptions | null;
  openModal: (options: GlobalModalOptions) => void;
  closeModal: () => void;
}

export const useGlobalModalStore = create<GlobalModalState>((set) => ({
  visible: false,
  modal: null,
  openModal: (options) => {
    set({ visible: true, modal: options });
  },
  closeModal: () => {
    set({ visible: false, modal: null });
  },
}));
