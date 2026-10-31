import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Empty,
  EmptyTitle,
  EmptyHeader,
  EmptyDescription,
  EmptyMedia,
  toast,
} from "ui";
import { AlertTriangle, FileText, Loader2, Save, ArrowRight, ShieldCheck } from "lucide-react";
import type { SaveData, EditResult } from "../../types";
import { useSettingsStore } from "../../stores/settings";
import { useSaveEditorStore } from "../../stores/save-editor";
import { SaveDetailPanel } from "./SaveDetailPanel";
import { SaveErrorGuide } from "./SaveErrorGuide";
import { buildEditPreview } from "./edit-preview";
import { getTextSaveReadOnlyMessage } from "./text-save-format-guidance";
import { getSaveLoadStartState } from "./save-load-state";
import { recordActivity } from "../../utils/activity-log";
import { translate } from "../../i18n";
import { ProWorkbenchPanel } from "./ProWorkbenchPanel";
import { CareerConstellation } from "./CareerConstellation";

type QuickAction = "unlock" | "maxSkills" | "repair" | "refuel";

const QUICK_ACTION_LABELS: Record<QuickAction, string> = {
  unlock: "Unlock all cities in this save?",
  maxSkills: "Max out all skills?",
  repair: "Repair all trucks?",
  refuel: "Refuel all trucks?",
};

const QUICK_ACTION_NAMES: Record<QuickAction, string> = {
  unlock: "Unlock Cities",
  maxSkills: "Max Skills",
  repair: "Repair All",
  refuel: "Refuel All",
};

const QUICK_ACTION_PREVIEWS: Record<QuickAction, string> = {
  unlock:
    "Marks cities found in this save as visited. The exact new city count is returned after the action.",
  maxSkills: "Sets ADR to 63 and the other supported driver skills to 6.",
  repair: "Sets supported truck wear values to 0%, including unfixable wear stored in the save.",
  refuel: "Sets each owned truck fuel value to full (100%).",
};

interface SaveEditorPageProps {
  readOnly: boolean;
  configPaths: string[];
  customPath: string | null;
  onStatusChange: (message: string) => void;
  onReloadSaves?: (selectSaveName?: string) => Promise<unknown> | unknown;
}

export function SaveEditorPage({
  readOnly,
  configPaths,
  customPath,
  onStatusChange,
  onReloadSaves,
}: SaveEditorPageProps) {
  const setIsSettingsOpen = useSettingsStore((state) => state.setIsSettingsOpen);
  const selectedProfile = useSaveEditorStore((s) => s.selectedProfile);
  const activeGame = useSaveEditorStore((s) => s.activeGame);
  const profiles = useSaveEditorStore((s) => s.profiles);
  const selectedSave = useSaveEditorStore((s) => s.selectedSave);
  const saveData = useSaveEditorStore((s) => s.saveData);
  const moneyInput = useSaveEditorStore((s) => s.moneyInput);
  const xpInput = useSaveEditorStore((s) => s.xpInput);

  const setSaveData = useSaveEditorStore((s) => s.setSaveData);
  const setMoneyInput = useSaveEditorStore((s) => s.setMoneyInput);
  const setXpInput = useSaveEditorStore((s) => s.setXpInput);
  const setSelectedSave = useSaveEditorStore((s) => s.setSelectedSave);
  const language = useSettingsStore((s) => s.language);
  const t = (text: string) => translate(language, text);

  const [deleteTarget, setDeleteTarget] = useState<"save" | null>(null);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [editPreviewOpen, setEditPreviewOpen] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [textFormatPrepared, setTextFormatPrepared] = useState(false);
  const [textFormatDialogOpen, setTextFormatDialogOpen] = useState(false);
  const [textFormatConfigPath, setTextFormatConfigPath] = useState("");
  const [gameClosedConfirmed, setGameClosedConfirmed] = useState(false);
  const [isPreparingTextFormat, setIsPreparingTextFormat] = useState(false);

  const reloadSave = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  // --- Load Save Data when selectedSave changes ---
  const saveSiiPath = selectedSave?.game_sii_path;
  const selectedGameMarkers =
    activeGame === "ats"
      ? ["american truck simulator", "270880"]
      : ["euro truck simulator 2", "227300"];
  const matchingGameConfigs =
    selectedGameMarkers.length > 0
      ? configPaths.filter((path) =>
          selectedGameMarkers.some((marker) => path.toLowerCase().includes(marker)),
        )
      : [];
  const selectedGameName =
    activeGame === "ats" ? "American Truck Simulator" : "Euro Truck Simulator 2";
  const effectiveTextFormatConfigPath = configPaths.includes(textFormatConfigPath)
    ? textFormatConfigPath
    : matchingGameConfigs.length === 1
      ? matchingGameConfigs[0]
      : configPaths.length === 1
        ? configPaths[0]
        : "";
  const textSaveReadOnlyMessage = getTextSaveReadOnlyMessage(readOnly);

  useEffect(() => {
    if (!saveSiiPath) {
      setSaveData(null);
      setLoadError(null);
      setTextFormatPrepared(false);
      setIsLoading(false);
      return;
    }

    let active = true;
    const loadStart = getSaveLoadStartState(useSaveEditorStore.getState().saveData);
    setSaveData(loadStart.saveData);
    setIsLoading(loadStart.isLoading);
    setLoadError(loadStart.loadError);
    setTextFormatPrepared(false);
    setTextFormatConfigPath("");
    onStatusChange("Loading save...");

    invoke<SaveData>("load_save", { gameId: activeGame, gameSiiPath: saveSiiPath })
      .then((data) => {
        if (!active) return;
        setSaveData(data);
        setMoneyInput(data.money_account ?? "");
        setXpInput(data.experience_points ?? "");
        const msg = `Save loaded${data.was_compressed ? " (was compressed)" : " (plaintext)"}`;
        onStatusChange(msg);
      })
      .catch((e) => {
        if (!active) return;
        setLoadError(String(e));
        toast.error(String(e));
        onStatusChange(`Error: ${e}`);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeGame, saveSiiPath, refetchKey, onStatusChange, setSaveData, setMoneyInput, setXpInput]);

  // --- Edit Money/XP ---
  const onEdit = useCallback(() => {
    if (!selectedSave) return;
    const money = moneyInput.trim() ? Number(moneyInput) : null;
    const xp = xpInput.trim() ? Number(xpInput) : null;
    if (
      (money !== null && !Number.isSafeInteger(money)) ||
      (xp !== null && !Number.isSafeInteger(xp))
    ) {
      const msg = "Money and XP must be whole numbers within the safe integer range";
      toast.error(msg);
      onStatusChange(msg);
      return;
    }
    if (money === null && xp === null) {
      const msg = "Enter a value for money or XP";
      toast.error(msg);
      onStatusChange(msg);
      return;
    }
    setEditPreviewOpen(true);
  }, [selectedSave, moneyInput, xpInput, onStatusChange]);

  const editPreviewRows = saveData
    ? buildEditPreview(
        { money: saveData.money_account, xp: saveData.experience_points },
        { money: moneyInput, xp: xpInput },
      )
    : [];

  const confirmEdit = useCallback(async () => {
    if (!selectedSave || editPreviewRows.length === 0 || readOnly) return;
    const money = moneyInput.trim() ? Number(moneyInput) : null;
    const xp = xpInput.trim() ? Number(xpInput) : null;
    onStatusChange("Saving...");
    try {
      const result = await invoke<EditResult>("edit_save", {
        gameSiiPath: selectedSave.game_sii_path,
        money,
        xp,
        createBackup,
      });
      toast.success(result.message);
      onStatusChange(result.message);
      recordActivity("values-edited", selectedSave.save_name);
      setEditPreviewOpen(false);
      reloadSave();
    } catch (e) {
      toast.error(String(e));
      onStatusChange(`Error: ${e}`);
    }
  }, [
    selectedSave,
    moneyInput,
    xpInput,
    createBackup,
    editPreviewRows.length,
    readOnly,
    onStatusChange,
    reloadSave,
  ]);

  // --- Quick Actions (with confirmation) ---
  const onUnlock = useCallback(() => {
    if (!selectedSave) return;
    setPendingAction("unlock");
  }, [selectedSave]);

  const onMaxSkills = useCallback(() => {
    if (!selectedSave) return;
    setPendingAction("maxSkills");
  }, [selectedSave]);

  const onRepair = useCallback(() => {
    if (!selectedSave) return;
    setPendingAction("repair");
  }, [selectedSave]);

  const onRefuel = useCallback(() => {
    if (!selectedSave) return;
    setPendingAction("refuel");
  }, [selectedSave]);

  const confirmAction = useCallback(async () => {
    if (!selectedSave || !pendingAction || readOnly || isManaging) return;
    const action = pendingAction;
    setPendingAction(null);

    const statusLabels: Record<QuickAction, string> = {
      unlock: "Unlocking cities...",
      maxSkills: "Maxing skills...",
      repair: "Repairing...",
      refuel: "Refueling...",
    };
    const invokeCommands: Record<QuickAction, string> = {
      unlock: "unlock_cities",
      maxSkills: "max_skills",
      repair: "repair_all",
      refuel: "refuel_all",
    };
    onStatusChange(statusLabels[action]);
    try {
      const result = await invoke<EditResult>(invokeCommands[action], {
        gameSiiPath: selectedSave.game_sii_path,
        createBackup,
      });
      toast.success(result.message);
      onStatusChange(result.message);
      const wasNoOp = [
        "No new cities to unlock.",
        "Skills already maxed.",
        "Everything already repaired.",
        "Everything already refueled.",
      ].includes(result.message);
      if (!wasNoOp) {
        const activityKind = {
          unlock: "cities-unlocked",
          maxSkills: "skills-maxed",
          repair: "trucks-repaired",
          refuel: "trucks-refueled",
        } as const;
        recordActivity(activityKind[action], selectedSave.save_name);
      }
      reloadSave();
    } catch (e) {
      toast.error(String(e));
      onStatusChange(`Error: ${e}`);
    }
  }, [selectedSave, pendingAction, readOnly, isManaging, createBackup, onStatusChange, reloadSave]);

  // --- Rename / Clone / Delete ---
  const onRename = useCallback(
    async (newName: string): Promise<boolean> => {
      if (!selectedSave || readOnly || isManaging) return false;
      const normalizedName = newName.trim();
      if (!normalizedName) return false;

      setIsManaging(true);
      onStatusChange("Renaming save...");
      try {
        const result = await invoke<EditResult>("rename_save", {
          gameSiiPath: selectedSave.game_sii_path,
          newName: normalizedName,
        });
        toast.success(result.message);
        onStatusChange(result.message);
        recordActivity("save-renamed", normalizedName);
        onReloadSaves?.();
        return true;
      } catch (e) {
        toast.error(String(e));
        onStatusChange(`Error: ${e}`);
        return false;
      } finally {
        setIsManaging(false);
      }
    },
    [selectedSave, readOnly, isManaging, onStatusChange, onReloadSaves],
  );

  const onClone = useCallback(
    async (newName: string): Promise<boolean> => {
      if (!selectedSave || readOnly || isManaging) return false;
      const normalizedName = newName.trim();
      if (!normalizedName) return false;

      setIsManaging(true);
      onStatusChange("Creating save copy...");
      try {
        const result = await invoke<EditResult>("clone_save", {
          gameSiiPath: selectedSave.game_sii_path,
          newName: normalizedName,
        });
        toast.success(result.message);
        onStatusChange(result.message);
        recordActivity("save-copied", normalizedName);
        try {
          await onReloadSaves?.(normalizedName);
        } catch (e) {
          toast.error(`Copy created, but the profile list could not be refreshed: ${String(e)}`);
        }
        return true;
      } catch (e) {
        toast.error(String(e));
        onStatusChange(`Error: ${e}`);
        return false;
      } finally {
        setIsManaging(false);
      }
    },
    [selectedSave, readOnly, isManaging, onStatusChange, onReloadSaves],
  );

  const onDelete = useCallback(() => {
    if (!selectedSave || readOnly || isManaging) return;
    setDeleteTarget("save");
  }, [selectedSave, readOnly, isManaging]);

  const confirmDeleteSave = useCallback(async () => {
    if (!selectedSave || readOnly || isManaging) return;
    const targetPath = selectedSave.game_sii_path;
    setDeleteTarget(null);
    setIsManaging(true);
    onStatusChange("Creating a full backup and deleting save...");
    try {
      const result = await invoke<EditResult>("delete_save", {
        gameSiiPath: targetPath,
      });
      toast.success("Save deleted. Full backup created.");
      onStatusChange(result.message);
      recordActivity("save-deleted", selectedSave.save_name);
      setSelectedSave(null);
      onReloadSaves?.();
    } catch (e) {
      toast.error(String(e));
      onStatusChange(`Error: ${e}`);
    } finally {
      setIsManaging(false);
    }
  }, [selectedSave, readOnly, isManaging, onStatusChange, setSelectedSave, onReloadSaves]);

  // --- Keyboard navigation ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (deleteTarget || pendingAction) return;
      if ((e.key === "s" || e.key === "S") && (e.metaKey || e.ctrlKey)) {
        if (!readOnly && selectedSave && saveData) {
          e.preventDefault();
          onEdit();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget, pendingAction, readOnly, selectedSave, saveData, onEdit]);

  // --- Render ---
  const showLoading = isLoading && !saveData;
  const isBsiiUnsupported = loadError?.includes("Binary format BSII not supported") ?? false;

  const prepareTextSaveFormat = async () => {
    if (!effectiveTextFormatConfigPath || readOnly || isPreparingTextFormat) return;
    setIsPreparingTextFormat(true);
    try {
      const result = await invoke<EditResult>("set_text_save_format", {
        path: effectiveTextFormatConfigPath,
        customPath,
      });
      toast.success(result.message);
      onStatusChange(result.message);
      setTextFormatPrepared(true);
      setTextFormatDialogOpen(false);
    } catch (e) {
      toast.error(`Could not enable text saves: ${String(e)}`);
    } finally {
      setIsPreparingTextFormat(false);
    }
  };

  if (showLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Loading save data...</p>
      </div>
    );
  }

  if (selectedSave && !saveData && loadError) {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto p-6">
        <section className="w-full max-w-xl space-y-4 rounded-2xl border border-amber-500/30 bg-card/70 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Could not read this save</h2>
              <p className="break-words text-sm text-muted-foreground">{loadError}</p>
            </div>
          </div>
          {!isBsiiUnsupported && <SaveErrorGuide error={loadError} />}
          {isBsiiUnsupported && (
            <div className="space-y-3 rounded-xl border border-border/50 bg-background/60 p-4">
              <p className="text-sm leading-6">
                This save uses the game's binary format. Roadbyte cannot convert the binary file by
                itself. It can safely enable text saves in the selected game config; then the game
                must open and save this save once to convert it.
              </p>
              {textFormatPrepared ? (
                <div className="space-y-3 text-sm">
                  <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                    <li>Close and reopen {selectedGameName}.</li>
                    <li>Load this save and save it again inside the game.</li>
                    <li>Return here and check the save again.</li>
                  </ol>
                  <Button type="button" variant="outline" onClick={reloadSave}>
                    Check converted save
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {configPaths.length > 0 ? (
                    <label className="block space-y-1.5 text-sm">
                      <span className="font-medium">Game config file</span>
                      <select
                        value={effectiveTextFormatConfigPath}
                        onChange={(event) => setTextFormatConfigPath(event.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono"
                      >
                        <option value="">Select config.cfg</option>
                        {configPaths.map((path) => (
                          <option key={path} value={path}>
                            {path}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No game config was found. Choose the game folder in Settings, then try again.
                    </p>
                  )}
                  {textSaveReadOnlyMessage && (
                    <p className="text-xs text-muted-foreground">{textSaveReadOnlyMessage}</p>
                  )}
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={!effectiveTextFormatConfigPath || isPreparingTextFormat}
                    onClick={() => {
                      if (readOnly) {
                        setIsSettingsOpen(true);
                        return;
                      }
                      setGameClosedConfirmed(false);
                      setTextFormatDialogOpen(true);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    {readOnly ? "Open Settings to enable" : "Enable text saves"}
                  </Button>
                </div>
              )}
            </div>
          )}
          <AlertDialog open={textFormatDialogOpen} onOpenChange={setTextFormatDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Enable text saves for {selectedGameName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Roadbyte will back up the selected config.cfg and set g_save_format to 2. This
                  does not edit the save file. Afterward, reopen ETS2, load this save, and save it
                  in-game. Text saves can take longer to create.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={gameClosedConfirmed}
                  onChange={(event) => setGameClosedConfirmed(event.target.checked)}
                  className="mt-1"
                />
                <span>I have closed {selectedGameName} before changing its config.</span>
              </label>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPreparingTextFormat}>Cancel</AlertDialogCancel>
                <Button
                  type="button"
                  disabled={!gameClosedConfirmed || isPreparingTextFormat || readOnly}
                  onClick={() => void prepareTextSaveFormat()}
                >
                  {isPreparingTextFormat ? "Updating config…" : "Back up config and continue"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    );
  }

  if (!selectedSave || !saveData) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Empty className="py-12 border border-dashed border-border/60 rounded-2xl bg-card/30 max-w-md w-full">
          <EmptyHeader>
            <EmptyMedia>
              <Save className="h-10 w-10 text-muted-foreground/60" />
            </EmptyMedia>
            <EmptyTitle>No save file selected</EmptyTitle>
            <EmptyDescription>
              {selectedProfile
                ? `Select a save from "${selectedProfile.display_name}" in the left sidebar to view stats and make edits.`
                : "Select a profile and save from the sidebar on the left to start editing your Euro Truck Simulator 2 save file."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-1">
      <SaveDetailPanel
        saveData={saveData}
        saveName={selectedSave.save_name}
        isManagementBusy={isManaging}
        moneyInput={moneyInput}
        xpInput={xpInput}
        readOnly={readOnly}
        onMoneyChange={setMoneyInput}
        onXpChange={setXpInput}
        onSaveEdits={onEdit}
        onUnlock={onUnlock}
        onMaxSkills={onMaxSkills}
        onRepair={onRepair}
        onRefuel={onRefuel}
        onRename={onRename}
        onClone={onClone}
        onDelete={onDelete}
      />

      <CareerConstellation saveData={saveData} />

      <ProWorkbenchPanel
        profiles={profiles}
        selectedSave={selectedSave}
        saveData={saveData}
        readOnly={readOnly}
        createBackup={createBackup}
        onCreateBackupChange={setCreateBackup}
        moneyInput={moneyInput}
        xpInput={xpInput}
        onReload={reloadSave}
      />

      <AlertDialog open={editPreviewOpen} onOpenChange={setEditPreviewOpen}>
        <AlertDialogContent className="max-w-lg rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Review changes before saving")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Confirm the exact values that will be written to this save.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {editPreviewRows.length > 0 ? (
            <div className="space-y-2">
              {editPreviewRows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">
                      {t(row.key === "money" ? "Money balance" : "Experience points")}
                    </p>
                    <p className="mt-1 truncate font-mono text-sm tabular-nums text-foreground">
                      {row.before}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{t("New value")}</p>
                    <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-primary">
                      {row.after}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  {t(
                    createBackup
                      ? "A full save backup is created before changed values are written. The original can be restored from Backup Center."
                      : "No backup will be created before saving these changes.",
                  )}
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={createBackup}
                  onChange={(event) => setCreateBackup(event.target.checked)}
                />
                {t("Create a backup before saving")}
              </label>
            </div>
          ) : (
            <p className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm text-muted-foreground">
              {t("The entered values match the save. There is nothing to change.")}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Go back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmEdit();
              }}
              disabled={readOnly || editPreviewRows.length === 0}
            >
              {t(createBackup ? "Create backup and save" : "Save without backup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Save</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{selectedSave?.save_name}” from the profile. Roadbyte will first create
              a complete copy of the save folder in a separate backup location. Deletion proceeds
              only if that backup succeeds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSave} disabled={isManaging || readOnly}>
              {isManaging ? "Deleting…" : "Back up and delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction ? t(QUICK_ACTION_NAMES[pendingAction]) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? t(QUICK_ACTION_LABELS[pendingAction]) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingAction && (
            <div className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {t(QUICK_ACTION_PREVIEWS[pendingAction])}
              </p>
              {(pendingAction === "repair" || pendingAction === "refuel") && (
                <div className="max-h-36 space-y-1.5 overflow-y-auto">
                  {saveData.trucks.length > 0 ? (
                    saveData.trucks.map((truck) => {
                      const before =
                        pendingAction === "refuel"
                          ? truck.fuel_relative == null
                            ? t("unknown")
                            : `${Math.round(truck.fuel_relative * 100)}%`
                          : (
                              [
                                ["Engine", truck.engine_wear],
                                ["Transmission", truck.transmission_wear],
                                ["Cabin", truck.cabin_wear],
                                ["Chassis", truck.chassis_wear],
                              ] as const
                            )
                              .flatMap(([label, value]) =>
                                value == null ? [] : [`${t(label)} ${Math.round(value * 100)}%`],
                              )
                              .join(" · ") || t("no wear data");
                      return (
                        <p
                          key={truck.index}
                          className="rounded-md bg-muted/35 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                        >
                          {t("Truck")} {truck.index + 1}: {before} →{" "}
                          {pendingAction === "refuel" ? "100%" : "0%"}
                        </p>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "No truck summary is available; the action uses supported values present in the save.",
                      )}
                    </p>
                  )}
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 border-t border-border/40 pt-2 text-[11px] leading-5 text-foreground">
                <input
                  type="checkbox"
                  checked={createBackup}
                  onChange={(event) => setCreateBackup(event.target.checked)}
                />
                {t("Create a backup before saving")}
              </label>
              <p className="text-[11px] leading-5 text-muted-foreground">
                {t(
                  createBackup
                    ? "A full save backup is created before changes are written."
                    : "No backup will be created before these changes.",
                )}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={readOnly || isManaging}>
              {t("Continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
