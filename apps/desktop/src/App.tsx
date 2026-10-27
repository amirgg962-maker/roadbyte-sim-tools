import { Suspense, lazy, useEffect, useState, useCallback, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "ui";
import { AppShell } from "./components/AppShell";
import { SidebarNav } from "./components/sidebar/SidebarNav";
import { Header } from "./components/Header";
import { StatusBar } from "./components/StatusBar";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import { CommandPalette } from "./components/CommandPalette";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import { FirstRunGuide } from "./components/settings/FirstRunGuide";
import { useSettingsStore } from "./stores/settings";
import { useSaveEditorStore } from "./stores/save-editor";
import type { WorkspaceTab } from "./stores/save-editor";
import type { ProfileInfo, SaveInfo } from "./types";
import { isSteamSynced } from "./utils/steam";

const SaveEditorPage = lazy(() =>
  import("./components/save-editor/SaveEditorPage").then((module) => ({
    default: module.SaveEditorPage,
  })),
);
const ConfigEditorPage = lazy(() =>
  import("./components/config-editor/ConfigEditorPage").then((module) => ({
    default: module.ConfigEditorPage,
  })),
);
const BackupCenterPage = lazy(() =>
  import("./components/backups/BackupCenterPage").then((module) => ({
    default: module.BackupCenterPage,
  })),
);

interface AppVersionInfo {
  app_version: string;
  game_version: string | null;
  tested_game_version: string;
  compatibility_warning: string | null;
  config_path?: string | null;
}

function App() {
  const {
    readOnly,
    customGamePath,
    setIsSettingsOpen,
    language,
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
  } = useSettingsStore();
  const {
    profiles,
    saves,
    selectedProfile,
    selectedSave,
    activeWorkspace,
    selectedConfigPath,
    setProfiles,
    setSaves,
    setSelectedProfile,
    setSelectedSave,
    setSaveData,
    setActiveWorkspace,
    setSelectedConfigPath,
  } = useSaveEditorStore();

  const [status, setStatus] = useState("");
  const [appInfo, setAppInfo] = useState<AppVersionInfo | null>(null);
  const [configPaths, setConfigPaths] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingSaves, setLoadingSaves] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [hasUnsavedConfigChanges, setHasUnsavedConfigChanges] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);
  const [isUnsavedConfigDialogOpen, setIsUnsavedConfigDialogOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingRequested, setOnboardingRequested] = useState(false);
  const pendingConfigNavigationRef = useRef<(() => void) | null>(null);
  const savesRequestIdRef = useRef(0);
  const hasUnsavedConfigChangesRef = useRef(false);
  const isConfigSavingRef = useRef(false);
  const allowWindowCloseRef = useRef(false);

  useEffect(() => {
    document.documentElement.lang = language === "fa" ? "fa-IR" : "en";
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    if (!isTauri()) return;
    void invoke("set_read_only", { readOnly }).catch((e) => {
      toast.error(`Could not update Read Only protection: ${String(e)}`);
    });
  }, [readOnly]);

  useEffect(() => {
    hasUnsavedConfigChangesRef.current = hasUnsavedConfigChanges;
  }, [hasUnsavedConfigChanges]);

  useEffect(() => {
    isConfigSavingRef.current = isConfigSaving;
  }, [isConfigSaving]);

  const requestConfigNavigation = useCallback(
    (action: () => void) => {
      if (activeWorkspace === "config" && isConfigSaving) {
        toast("Please wait for Config Editor to finish saving before navigating.");
        return;
      }
      if (activeWorkspace === "config" && hasUnsavedConfigChanges) {
        pendingConfigNavigationRef.current = action;
        setIsUnsavedConfigDialogOpen(true);
        return;
      }
      action();
    },
    [activeWorkspace, hasUnsavedConfigChanges, isConfigSaving],
  );

  const onSelectWorkspace = useCallback(
    (workspace: WorkspaceTab) => {
      if (workspace === activeWorkspace) return;
      requestConfigNavigation(() => setActiveWorkspace(workspace));
    },
    [activeWorkspace, requestConfigNavigation, setActiveWorkspace],
  );

  const discardAndContinueNavigation = useCallback(() => {
    const nextAction = pendingConfigNavigationRef.current;
    pendingConfigNavigationRef.current = null;
    hasUnsavedConfigChangesRef.current = false;
    setHasUnsavedConfigChanges(false);
    setIsUnsavedConfigDialogOpen(false);
    nextAction?.();
  }, []);

  // Protect against closing the desktop window while config edits are dirty.
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    getCurrentWindow()
      .onCloseRequested((event) => {
        if (allowWindowCloseRef.current) return;
        if (isConfigSavingRef.current) {
          event.preventDefault();
          toast("Please wait for Config Editor to finish saving before closing Roadbyte.");
          return;
        }
        if (!hasUnsavedConfigChangesRef.current) return;
        event.preventDefault();
        pendingConfigNavigationRef.current = () => {
          allowWindowCloseRef.current = true;
          hasUnsavedConfigChangesRef.current = false;
          void getCurrentWindow().close();
        };
        setIsUnsavedConfigDialogOpen(true);
      })
      .then((stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      })
      .catch(() => {
        // The in-app navigation guard still works if the window event is unavailable.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // App version info
  useEffect(() => {
    let active = true;
    const selectedConfigDirectory = selectedConfigPath?.replace(/[\\/][^\\/]+$/, "");
    invoke<AppVersionInfo>("get_app_info", {
      customPath: selectedConfigDirectory || customGamePath || null,
    })
      .then((info) => {
        if (active) setAppInfo({ ...info, config_path: selectedConfigPath ?? null });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [customGamePath, selectedConfigPath]);

  // List configs
  useEffect(() => {
    invoke<string[]>("list_configs", { customPath: customGamePath || null })
      .then((paths) => {
        setConfigPaths(paths);
        const storeSelected = useSaveEditorStore.getState().selectedConfigPath;
        if (paths.length > 0 && !storeSelected) {
          const first = paths[0];
          if (first != null) {
            setSelectedConfigPath(first);
          }
        }
      })
      .catch(() => {});
  }, [customGamePath, setSelectedConfigPath]);

  // Load profiles & fetch saves for active profile (NO auto-select save)
  const loadProfiles = useCallback(
    async (showToast = false) => {
      const requestId = ++savesRequestIdRef.current;
      setLoadingProfiles(true);
      setStatus("Loading profiles...");
      try {
        const fetchedProfiles = await invoke<ProfileInfo[]>("list_profiles", {
          customPath: customGamePath || null,
        });
        if (requestId !== savesRequestIdRef.current) return;
        setProfiles(fetchedProfiles);
        const msg = `Found ${fetchedProfiles.length} profile${fetchedProfiles.length !== 1 ? "s" : ""}`;
        if (showToast) toast.success(msg);
        setStatus(msg);

        // Select initial profile, but leave save unselected for user manual choice
        if (fetchedProfiles.length > 0) {
          const currentPath = useSaveEditorStore.getState().selectedProfile?.path;
          const targetProf =
            fetchedProfiles.find((p) => p.path === currentPath) || fetchedProfiles[0];
          if (targetProf) {
            setSelectedProfile(targetProf);
            setSelectedSave(null);
            setSaveData(null);

            setLoadingSaves(true);
            try {
              const fetchedSaves = await invoke<SaveInfo[]>("get_saves", {
                profilePath: targetProf.path,
              });
              if (requestId === savesRequestIdRef.current) setSaves(fetchedSaves);
            } finally {
              if (requestId === savesRequestIdRef.current) setLoadingSaves(false);
            }
          }
        } else {
          setSelectedProfile(null);
          setSelectedSave(null);
          setSaveData(null);
          setSaves([]);
          setLoadingSaves(false);
        }
      } catch (e) {
        if (requestId !== savesRequestIdRef.current) return;
        toast.error(String(e));
        setStatus(`Error: ${e}`);
      } finally {
        setLoadingProfiles(false);
      }
    },
    [customGamePath, setProfiles, setSelectedProfile, setSaves, setSelectedSave, setSaveData],
  );

  useEffect(() => {
    loadProfiles(false);
  }, [loadProfiles]);

  // Select profile handler (resets save selection)
  const onSelectProfile = useCallback(
    async (profile: ProfileInfo) => {
      const requestId = ++savesRequestIdRef.current;
      setSelectedProfile(profile);
      setSelectedSave(null);
      setSaveData(null);
      setLoadingSaves(true);
      setStatus("Loading saves...");
      try {
        const fetchedSaves = await invoke<SaveInfo[]>("get_saves", {
          profilePath: profile.path,
        });
        if (requestId !== savesRequestIdRef.current) return;
        setSaves(fetchedSaves);
        setStatus(`Found ${fetchedSaves.length} saves`);
      } catch (e) {
        if (requestId !== savesRequestIdRef.current) return;
        toast.error(String(e));
        setStatus(`Error: ${e}`);
      } finally {
        if (requestId === savesRequestIdRef.current) setLoadingSaves(false);
      }
    },
    [setSelectedProfile, setSelectedSave, setSaveData, setSaves],
  );

  // Navigation actions are wrapped so dirty config edits cannot be lost silently.
  const selectSaveImmediately = useCallback(
    (save: SaveInfo) => {
      setSelectedSave(save);
      setActiveWorkspace("saves");
    },
    [setSelectedSave, setActiveWorkspace],
  );

  const onSelectSave = useCallback(
    (save: SaveInfo) => requestConfigNavigation(() => selectSaveImmediately(save)),
    [requestConfigNavigation, selectSaveImmediately],
  );

  // Selecting another config file also replaces the current editor contents.
  const onSelectConfig = useCallback(
    (path: string) => {
      if (activeWorkspace === "config" && selectedConfigPath === path) return;
      requestConfigNavigation(() => {
        setSelectedConfigPath(path);
        setActiveWorkspace("config");
      });
    },
    [
      activeWorkspace,
      selectedConfigPath,
      requestConfigNavigation,
      setSelectedConfigPath,
      setActiveWorkspace,
    ],
  );

  const onCommandPaletteSelectSave = useCallback(
    (profile: ProfileInfo, save?: SaveInfo) => {
      requestConfigNavigation(() => {
        void onSelectProfile(profile)
          .then(() => {
            if (save && !isSteamSynced(save.path) && !isSteamSynced(profile.path)) {
              selectSaveImmediately(save);
            } else if (save && (isSteamSynced(save.path) || isSteamSynced(profile.path))) {
              toast("Steam Cloud-synced save cannot be edited directly");
            }
          })
          .catch((e) => {
            toast.error(String(e));
          });
      });
    },
    [requestConfigNavigation, onSelectProfile, selectSaveImmediately],
  );

  // Shortcut for Ctrl+, (Open Settings)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setIsSettingsOpen]);

  return (
    <AppShell
      sidebar={
        <SidebarNav
          appInfo={appInfo}
          profiles={profiles}
          saves={saves}
          selectedProfile={selectedProfile}
          selectedSave={selectedSave}
          configPaths={configPaths}
          selectedConfigPath={selectedConfigPath}
          loadingProfiles={loadingProfiles}
          loadingSaves={loadingSaves}
          onSelectProfile={onSelectProfile}
          onSelectSave={onSelectSave}
          onSelectConfig={onSelectConfig}
          onSelectWorkspace={onSelectWorkspace}
          onRefreshProfiles={() => loadProfiles(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
        />
      }
      header={
        <Header
          activeWorkspace={activeWorkspace}
          selectedProfile={selectedProfile}
          selectedSave={selectedSave}
          selectedConfigPath={selectedConfigPath}
          appInfo={appInfo}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />
      }
      main={
        <Suspense fallback={<div className="h-full" aria-busy="true" />}>
          {activeWorkspace === "saves" ? (
            <SaveEditorPage
              readOnly={readOnly}
              configPaths={configPaths}
              customPath={customGamePath || null}
              onStatusChange={setStatus}
              onReloadSaves={(selectSaveName) => {
                if (!selectedProfile) return;
                if (!selectSaveName) return onSelectProfile(selectedProfile);
                return invoke<SaveInfo[]>("get_saves", { profilePath: selectedProfile.path }).then(
                  (fetchedSaves) => {
                    setSaves(fetchedSaves);
                    const createdCopy = fetchedSaves.find(
                      (save) => save.save_name.toLowerCase() === selectSaveName.toLowerCase(),
                    );
                    if (createdCopy) {
                      setSaveData(null);
                      setSelectedSave(createdCopy);
                    } else {
                      toast.error(
                        "The copy was created, but it could not be found in the refreshed profile list.",
                      );
                    }
                  },
                );
              }}
            />
          ) : activeWorkspace === "config" ? (
            <ConfigEditorPage
              readOnly={readOnly}
              onStatusChange={setStatus}
              onDirtyStateChange={setHasUnsavedConfigChanges}
              onSavingStateChange={setIsConfigSaving}
              selectedConfigPath={selectedConfigPath}
              gameVersion={
                appInfo?.config_path === selectedConfigPath
                  ? (appInfo.game_version ?? undefined)
                  : undefined
              }
            />
          ) : (
            <BackupCenterPage
              profilePaths={profiles.map((profile) => profile.path)}
              customPath={customGamePath || null}
              readOnly={readOnly}
              onRefreshProfiles={() => loadProfiles(true)}
            />
          )}
        </Suspense>
      }
      status={<StatusBar message={status} />}
    >
      <SettingsDialog appInfo={appInfo} onOpenSetupGuide={() => setOnboardingRequested(true)} />
      <FirstRunGuide
        open={onboardingRequested || (!hasCompletedOnboarding && !onboardingDismissed)}
        onLater={() => {
          setOnboardingDismissed(true);
          setOnboardingRequested(false);
        }}
        onComplete={() => {
          setHasCompletedOnboarding(true);
          setOnboardingDismissed(true);
          setOnboardingRequested(false);
        }}
        onOpenGameSettings={() => setIsSettingsOpen(true)}
        onGoTo={onSelectWorkspace}
      />
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        configPaths={configPaths}
        onSelectSave={onCommandPaletteSelectSave}
        onSelectConfig={onSelectConfig}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />
      <KeyboardShortcutsDialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
      <AlertDialog
        open={isUnsavedConfigDialogOpen}
        onOpenChange={(open) => {
          setIsUnsavedConfigDialogOpen(open);
          if (!open) pendingConfigNavigationRef.current = null;
        }}
      >
        <AlertDialogContent className="rounded-xl border border-border/50 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              Unsaved configuration changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have edits that have not been saved to the game config file. If you continue,
              those edits will be discarded. Save your changes first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Stay and keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndContinueNavigation} className="rounded-lg">
              Discard changes and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

export default App;
