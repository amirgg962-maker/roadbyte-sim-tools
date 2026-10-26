import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
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
  Kbd,
  toast,
} from "ui";
import * as v from "valibot";
import { FolderCog, RefreshCw } from "lucide-react";
import type { ConfigDocument, ConfigValueType, EditResult } from "../../types";
import { CONFIG_DESCRIPTIONS } from "../../config-descriptions";
import { ConfigToolbar } from "./FileSelectorBar";
import { ConfigTable, formatKeyName } from "./ConfigTable";

import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { useSaveEditorStore } from "../../stores/save-editor";
import { getConfigDiff } from "./config-diff";
import { getConfigDisplayCategory, inferConfigGame } from "../../config-metadata";
import { CONFIG_RANGES } from "../../config-ranges";
import { getConfigRecoveryState } from "./config-recovery";

interface ConfigEditorPageProps {
  readOnly: boolean;
  onStatusChange: (message: string) => void;
  onDirtyStateChange: (dirty: boolean) => void;
  onSavingStateChange: (saving: boolean) => void;
  selectedConfigPath?: string | null;
  gameVersion?: string;
}

const IntSchema = v.pipe(v.string(), v.regex(/^-?\d+$/));
const FloatSchema = v.pipe(v.string(), v.regex(/^-?\d*\.?\d+$/));
const BoolSchema = v.union([v.literal("0"), v.literal("1"), v.literal("true"), v.literal("false")]);
const StringSchema = v.pipe(v.string(), v.regex(/^[^"\r\n]*$/));

function validateValue(value: string, type: ConfigValueType): string | null {
  const result = v.safeParse(
    type === "Int"
      ? IntSchema
      : type === "Float"
        ? FloatSchema
        : type === "Bool"
          ? BoolSchema
          : StringSchema,
    value,
  );
  if (result.success) return null;
  const issue = result.issues[0];
  if (issue) {
    if (type === "Int") return "Expected an integer";
    if (type === "Float") return "Expected a number";
    if (type === "Bool") return "Expected 0, 1, true, or false";
    if (type === "String") return 'Text cannot contain " or line breaks';
  }
  return "Invalid value";
}

export function ConfigEditorPage({
  readOnly,
  onStatusChange,
  onDirtyStateChange,
  onSavingStateChange,
  selectedConfigPath,
  gameVersion,
}: ConfigEditorPageProps) {
  const customGamePath = useSettingsStore((s) => s.customGamePath);
  const openGamePathSettings = useSettingsStore((s) => s.openGamePathSettings);
  const language = useSettingsStore((s) => s.language);
  const t = (text: string) => translate(language, text);
  const [configPaths, setConfigPaths] = useState<string[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [configDoc, setConfigDoc] = useState<ConfigDocument | null>(null);
  const [configFilter, setConfigFilter] = useState("");
  const [configCategory, setConfigCategory] = useState("");
  const [configErrors, setConfigErrors] = useState<Record<number, string | null>>({});
  const [originalValues, setOriginalValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savePreviewOpen, setSavePreviewOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const configGame = inferConfigGame(selectedConfig ?? selectedConfigPath ?? "");

  const changedEntries = useMemo(
    () =>
      configDoc?.entries.flatMap((entry, index) =>
        originalValues[index] !== undefined && entry.value !== originalValues[index]
          ? [{ entry, index }]
          : [],
      ) ?? [],
    [configDoc, originalValues],
  );
  const configDiff = useMemo(
    () => (configDoc ? getConfigDiff(configDoc.entries, originalValues) : []),
    [configDoc, originalValues],
  );

  const hasUnsavedChanges = Boolean(
    configDoc?.entries.some((entry, index) => {
      const original = originalValues[index];
      return original !== undefined && entry.value !== original;
    }),
  );

  useEffect(() => {
    onDirtyStateChange(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyStateChange]);

  useEffect(() => {
    if (!hasUnsavedChanges || isTauri()) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    onSavingStateChange(isSaving);
  }, [isSaving, onSavingStateChange]);

  const selectConfig = useCallback(
    async (path: string, activeRef?: { current: boolean }) => {
      setSelectedConfig(path);
      setConfigDoc(null);
      setLoadError(null);
      setConfigFilter("");
      setConfigCategory("");
      setConfigErrors({});
      onStatusChange("Loading config...");
      try {
        const result = await invoke<ConfigDocument>("load_config", {
          path,
          customPath: customGamePath || null,
        });
        if (activeRef && !activeRef.current) return;
        setConfigDoc(result);
        setOriginalValues(result.entries.map((entry) => entry.value));
        const msg = `Loaded ${result.entries.length} entries`;
        onStatusChange(msg);
      } catch (e) {
        if (activeRef && !activeRef.current) return;
        setLoadError(String(e));
        toast.error(String(e));
        onStatusChange(`Error: ${e}`);
      }
    },
    [onStatusChange],
  );

  useEffect(() => {
    let active = true;
    const activeRef = { current: true };

    async function init() {
      setLoading(true);
      setSelectedConfig(null);
      setConfigDoc(null);
      setConfigFilter("");
      setConfigCategory("");
      setConfigErrors({});
      setOriginalValues([]);
      setConfigPaths([]);
      setLoadError(null);
      setDiscoveryError(null);
      onStatusChange("Searching config files...");

      try {
        const paths = await invoke<string[]>("list_configs", {
          customPath: customGamePath || null,
        });

        if (!active) return;
        setConfigPaths(paths);

        const storeState = useSaveEditorStore.getState();
        const currentSelected = storeState.selectedConfigPath;
        const targetPath =
          currentSelected && paths.includes(currentSelected) ? currentSelected : paths[0];

        if (targetPath != null) {
          await selectConfig(targetPath, activeRef);
          if (targetPath !== currentSelected) {
            storeState.setSelectedConfigPath(targetPath);
          }
        } else {
          if (currentSelected) storeState.setSelectedConfigPath(null);
          onStatusChange("No config files found");
        }
      } catch (e) {
        if (!active) return;
        setDiscoveryError(String(e));
        toast.error(String(e));
        onStatusChange(`Error: ${e}`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      active = false;
      activeRef.current = false;
    };
  }, [customGamePath, onStatusChange, selectConfig]);

  useEffect(() => {
    if (selectedConfigPath && selectedConfigPath !== selectedConfig) {
      selectConfig(selectedConfigPath);
    }
  }, [selectedConfigPath, selectedConfig, selectConfig]);

  const retryConfigDiscovery = useCallback(async () => {
    setLoading(true);
    setDiscoveryError(null);
    setLoadError(null);
    try {
      const paths = await invoke<string[]>("list_configs", {
        customPath: customGamePath || null,
      });
      setConfigPaths(paths);
      const currentSelected = useSaveEditorStore.getState().selectedConfigPath;
      const targetPath = currentSelected && paths.includes(currentSelected) ? currentSelected : paths[0];
      if (targetPath) {
        await selectConfig(targetPath);
        useSaveEditorStore.getState().setSelectedConfigPath(targetPath);
      } else {
        setSelectedConfig(null);
        setConfigDoc(null);
        useSaveEditorStore.getState().setSelectedConfigPath(null);
        onStatusChange("No config files found");
      }
    } catch (error) {
      setDiscoveryError(String(error));
      toast.error(String(error));
      onStatusChange(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [customGamePath, onStatusChange, selectConfig]);

  const commitConfigSave = useCallback(async (): Promise<boolean> => {
    if (!selectedConfig || !configDoc || readOnly || isSaving) return false;
    const entriesToSave = configDoc.entries.map((entry) => ({ ...entry }));
    if (changedEntries.length === 0) return false;
    setIsSaving(true);
    onStatusChange("Saving config and verifying the written file...");
    try {
      const result = await invoke<EditResult>("save_config", {
        path: selectedConfig,
        entries: entriesToSave,
        expectedEntries: configDoc.entries.map((entry, index) => ({
          ...entry,
          value: originalValues[index] ?? entry.value,
        })),
        customPath: customGamePath || null,
      });

      // Read the config back from disk. Only mark the editor clean if the saved
      // values can be observed again through the normal file-loading command.
      const persistedDoc = await invoke<ConfigDocument>("load_config", {
        path: selectedConfig,
        customPath: customGamePath || null,
      });
      const mismatches = changedEntries.filter(
        ({ entry, index }) => persistedDoc.entries[index]?.value !== entry.value,
      );

      if (mismatches.length > 0) {
        toast.error(
          `Save could not be verified: ${mismatches.length} value${mismatches.length === 1 ? "" : "s"} did not match the file on disk. Your edits remain in the editor.`,
        );
        onStatusChange("Save verification failed; unsaved edits were kept in the editor.");
        return false;
      }

      setConfigDoc(persistedDoc);
      setOriginalValues(persistedDoc.entries.map((entry) => entry.value));
      setConfigErrors({});
      toast.success("Config saved and verified from disk");
      onStatusChange(`${result.message} · verified from disk`);
      return true;
    } catch (e) {
      toast.error(String(e));
      onStatusChange(`Error: ${e}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedConfig,
    configDoc,
    changedEntries,
    onStatusChange,
    readOnly,
    isSaving,
    customGamePath,
    originalValues,
  ]);

  const onConfigSave = useCallback(() => {
    if (!selectedConfig || !configDoc || readOnly || isSaving) return;
    if (Object.values(configErrors).some((error) => error !== null)) return;
    if (changedEntries.length === 0) {
      toast("No configuration changes to save.");
      return;
    }
    setSavePreviewOpen(true);
  }, [selectedConfig, configDoc, readOnly, isSaving, configErrors, changedEntries.length]);

  const confirmConfigSave = useCallback(async () => {
    const saved = await commitConfigSave();
    if (saved) setSavePreviewOpen(false);
  }, [commitConfigSave]);

  const onConfigValueChange = useCallback(
    (entryIndex: number, value: string, type: ConfigValueType) => {
      if (!configDoc) return;
      const entry = configDoc.entries[entryIndex];
      if (!entry) return;
      const error = validateValue(value, type);
      setConfigErrors((prev) => ({ ...prev, [entryIndex]: error }));
      setConfigDoc({
        ...configDoc,
        entries: configDoc.entries.map((e, index) => (index === entryIndex ? { ...e, value } : e)),
      });
    },
    [configDoc],
  );

  const onRevert = useCallback(
    (entryIndex: number) => {
      const original = originalValues[entryIndex];
      if (!configDoc || original === undefined) return;
      const entry = configDoc.entries[entryIndex];
      if (!entry) return;
      onConfigValueChange(entryIndex, original, entry.value_type);
    },
    [configDoc, originalValues, onConfigValueChange],
  );

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        const hasErrors = Object.values(configErrors).some((er) => er !== null);
        if (!readOnly && !isSaving && !hasErrors) {
          e.preventDefault();
          onConfigSave();
        }
      }
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const searchInput = document.getElementById("config-search") as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, isSaving, configErrors, onConfigSave]);

  const filteredEntries =
    configDoc?.entries.flatMap((e, index) => {
      const category = getConfigDisplayCategory(e.key, configGame, gameVersion, {
        description: CONFIG_DESCRIPTIONS[e.key],
        range: CONFIG_RANGES[e.key],
      });
      if (configCategory && category !== configCategory) return [];
      if (configFilter) {
        const q = configFilter.toLowerCase();
        if (
          !(
            e.key.toLowerCase().includes(q) ||
            e.value.toLowerCase().includes(q) ||
            category.toLowerCase().includes(q) ||
            formatKeyName(e.key).toLowerCase().includes(q)
          )
        )
          return [];
      }
      return [{ entry: e, index }];
    }) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        {t("Loading config...")}
      </div>
    );
  }

  if (!configDoc) {
    const recoveryState = getConfigRecoveryState({
      configCount: configPaths.length,
      selectedPath: selectedConfig,
      loadError,
      discoveryError,
    });
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-lg text-sm text-muted-foreground">
          {t(
            recoveryState.message === "missing"
              ? "No config files were found. Check the game folder or scan again."
              : recoveryState.message === "discovery-error"
                ? "Config discovery failed. Retry the scan or choose a game folder."
                : "The config file was found but could not be loaded. Retry opening it or choose a game folder.",
          )}
        </p>
        {loadError && (
          <p className="max-w-lg break-all font-mono text-[11px] text-muted-foreground/80">
            {loadError}
          </p>
        )}
        {discoveryError && (
          <p className="max-w-lg break-all font-mono text-[11px] text-muted-foreground/80">
            {discoveryError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (recoveryState.retry === "scan") {
                void retryConfigDiscovery();
              } else {
                const path = selectedConfig ?? configPaths[0];
                if (path) void selectConfig(path);
              }
            }}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {t(recoveryState.retry === "scan" ? "Retry config scan" : "Retry loading config")}
          </Button>
          <Button size="sm" onClick={openGamePathSettings}>
            <FolderCog className="mr-2 h-3.5 w-3.5" />
            {t("Open game-path settings")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 bg-background pb-2">
        <ConfigToolbar
          configFilter={configFilter}
          onFilterChange={setConfigFilter}
          configCategory={configCategory}
          onCategoryChange={setConfigCategory}
          categories={[
            ...new Set(
              configDoc.entries
                .map((entry) =>
                  getConfigDisplayCategory(entry.key, configGame, gameVersion, {
                    description: CONFIG_DESCRIPTIONS[entry.key],
                    range: CONFIG_RANGES[entry.key],
                  }),
                ),
            ),
            // This is a new array from Set, so sorting it cannot mutate shared config state.
            // oxlint-disable-next-line unicorn/no-array-sort
          ].sort((a, b) => a.localeCompare(b))}
          matchCount={filteredEntries.length}
          totalCount={configDoc.entries.length}
        />
        <Button
          variant="default"
          size="sm"
          onClick={onConfigSave}
          disabled={readOnly || isSaving || Object.values(configErrors).some((e) => e !== null)}
          aria-keyshortcuts="Control+S"
          className="gap-2"
        >
          <span>{t(isSaving ? "Saving..." : "Save Config")}</span>
          <Kbd className="bg-primary-foreground/20 text-primary-foreground text-[10px]">Ctrl+S</Kbd>
        </Button>
      </div>

      {Object.values(configErrors).some((e) => e !== null) && (
        <div className="text-xs text-destructive">{t("Fix validation errors before saving")}</div>
      )}

      {filteredEntries.length > 0 ? (
        <div className="overflow-x-auto">
          <ConfigTable
            entries={filteredEntries}
            configErrors={configErrors}
            originalValues={originalValues}
            onValueChange={onConfigValueChange}
            onRevert={onRevert}
            descriptions={CONFIG_DESCRIPTIONS}
            game={configGame}
            gameVersion={gameVersion}
            readOnly={readOnly || isSaving}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("No entries match the filter.")}</p>
      )}

      <div className="text-xs text-muted-foreground">
        {filteredEntries.length} / {configDoc.entries.length}{" "}
        {language === "fa" ? "مورد" : "entries"}
      </div>

      <AlertDialog
        open={savePreviewOpen}
        onOpenChange={(open) => !isSaving && setSavePreviewOpen(open)}
      >
        <AlertDialogContent className="max-h-[85vh] max-w-2xl overflow-hidden rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Review config changes")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Review each changed setting before writing this configuration file.")}
              {selectedConfig ? (
                <span className="mt-1 block break-all font-mono text-xs">{selectedConfig}</span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {configDiff.map((change) => (
              <div
                key={change.key}
                className="rounded-lg border border-border/50 bg-background/45 p-3"
              >
                <p className="break-all font-mono text-xs font-semibold text-foreground">
                  {change.key}
                </p>
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                  <span className="break-all rounded-md bg-muted/40 px-2 py-1 font-mono text-muted-foreground">
                    {change.before}
                  </span>
                  <span aria-hidden="true" className="text-primary">
                    →
                  </span>
                  <span className="break-all rounded-md bg-primary/10 px-2 py-1 font-mono text-primary">
                    {change.after}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.045] p-3 text-xs leading-5 text-muted-foreground">
            {t(
              "Roadbyte creates a backup before writing, then reads the file again to verify the saved values.",
            )}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t("Go back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmConfigSave();
              }}
              disabled={readOnly || isSaving || configDiff.length === 0}
            >
              {t("Create backup and save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
