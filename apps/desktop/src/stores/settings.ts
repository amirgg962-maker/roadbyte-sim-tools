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
  isSettingsOpen: boolean;

  setReadOnly: (value: boolean) => void;
  setLastTab: (tab: TabId) => void;
  setCustomGamePath: (path: string) => void;
  setLanguage: (language: AppLanguage) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      readOnly: true,
      lastTab: "saves",
      customGamePath: "",
      language: "en",
      isSettingsOpen: false,

      setReadOnly: (readOnly) => set({ readOnly }),
      setLastTab: (lastTab) => set({ lastTab }),
      setCustomGamePath: (customGamePath) => set({ customGamePath }),
      setLanguage: (language) => set({ language }),
      setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
    }),
    {
      name: "settings",
      storage: getPersistStorage(),
      partialize: (state) => ({
        readOnly: state.readOnly,
        lastTab: state.lastTab,
        customGamePath: state.customGamePath,
        language: state.language,
      }),
    },
  ),
);
