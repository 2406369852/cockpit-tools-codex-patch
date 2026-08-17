import { useCallback } from 'react';
import { useGlobalModalStore, type GlobalModalOptions } from '../stores/useGlobalModalStore';

export function useGlobalModal() {
  const openModal = useGlobalModalStore((state) => state.openModal);
  const closeModal = useGlobalModalStore((state) => state.closeModal);

  const showModal = useCallback((options: GlobalModalOptions) => {
    openModal(options);
  }, [openModal]);

  return {
    showModal,
    closeModal,
  };
}
