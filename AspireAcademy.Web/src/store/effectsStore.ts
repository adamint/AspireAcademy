import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface EffectsStore {
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const useEffectsStore = create<EffectsStore>()(
  persist(
    (set) => ({
      soundEnabled: false,
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
    }),
    {
      name: 'aspire-effects-settings',
    }
  )
);
