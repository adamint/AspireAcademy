import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EditorFontSize = 'small' | 'medium' | 'large';

interface SettingsState {
  editorFontSize: EditorFontSize;
  animationsEnabled: boolean;
  achievementNotifications: boolean;
  dailyReminder: boolean;
  friendActivity: boolean;
  showHintsByDefault: boolean;
  autoAdvance: boolean;
  showLineNumbers: boolean;
}

interface SettingsActions {
  setEditorFontSize: (size: EditorFontSize) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setAchievementNotifications: (enabled: boolean) => void;
  setDailyReminder: (enabled: boolean) => void;
  setFriendActivity: (enabled: boolean) => void;
  setShowHintsByDefault: (enabled: boolean) => void;
  setAutoAdvance: (enabled: boolean) => void;
  setShowLineNumbers: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      editorFontSize: 'medium',
      animationsEnabled: true,
      achievementNotifications: true,
      dailyReminder: false,
      friendActivity: true,
      showHintsByDefault: true,
      autoAdvance: false,
      showLineNumbers: true,

      setEditorFontSize: (size) => set({ editorFontSize: size }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      setAchievementNotifications: (enabled) => set({ achievementNotifications: enabled }),
      setDailyReminder: (enabled) => set({ dailyReminder: enabled }),
      setFriendActivity: (enabled) => set({ friendActivity: enabled }),
      setShowHintsByDefault: (enabled) => set({ showHintsByDefault: enabled }),
      setAutoAdvance: (enabled) => set({ autoAdvance: enabled }),
      setShowLineNumbers: (enabled) => set({ showLineNumbers: enabled }),
    }),
    {
      name: 'aspire-learn-settings',
    }
  )
);
