import { create } from 'zustand';

interface SearchStore {
  open: boolean;
  toggle: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
  setOpen: (open: boolean) => set({ open }),
}));
