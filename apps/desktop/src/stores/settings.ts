import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getPersistStorage } from "./storage";

export type TabId = "saves" | "config" | "settings";
export type AppLanguage = "en" | "fa";

interface SettingsState {
  readOnly: boolean;
  lastTab: TabId;
  customGamePath: string;
  language: AppLanguage;
  hasCompletedOnboarding: boolean;
  isSettingsOpen: boolean;
  settingsTarget: "game-directory" | null;

  setReadOnly: (value: boolean) => void;
  setLastTab: (tab: TabId) => void;
  setCustomGamePath: (path: string) => void;
  setLanguage: (language: AppLanguage) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  openGamePathSettings: () => void;
  clearSettingsTarget: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      readOnly: true,
      lastTab: "saves",
      customGamePath: "",
      language: "en",
      hasCompletedOnboarding: false,
      isSettingsOpen: false,
      settingsTarget: null,

      setReadOnly: (readOnly) => set({ readOnly }),
      setLastTab: (lastTab) => set({ lastTab }),
      setCustomGamePath: (customGamePath) => set({ customGamePath }),
      setLanguage: (language) => set({ language }),
      setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
      setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      openGamePathSettings: () => set({ isSettingsOpen: true, settingsTarget: "game-directory" }),
      clearSettingsTarget: () => set({ settingsTarget: null }),
    }),
    {
      name: "settings",
      storage: getPersistStorage(),
      partialize: (state) => ({
        readOnly: state.readOnly,
        lastTab: state.lastTab,
        customGamePath: state.customGamePath,
        language: state.language,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    },
  ),
);
