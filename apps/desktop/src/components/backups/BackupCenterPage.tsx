import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { BackupActionResult, BackupEntry } from "../../types";
import type { SaveData } from "../../types";
import { summarizeSaveDelta } from "../../utils/roadbyte-workbench.js";
import { SaveStoryPanel } from "./SaveStoryPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Input,
  toast,
} from "ui";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  FileBox,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  GitCompareArrows,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { recordActivity } from "../../utils/activity-log";

type PendingAction = { kind: "restore" | "delete"; backup: BackupEntry } | null;
type BackupVerification = { valid: boolean; fileCount: number; sizeBytes: number; message: string };

interface BackupCenterPageProps {
  profilePaths: string[];
  customPath: string | null;
  readOnly: boolean;
  onRefreshProfiles: () => Promise<unknown> | unknown;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function formatBackupDate(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(value);
  if (!match) return value.replace(/_/g, " ");
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function BackupCenterPage({
  profilePaths,
  customPath,
  readOnly,
  onRefreshProfiles,
}: BackupCenterPageProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const pathsKey = profilePaths.join("\n");
  const stableProfilePaths = useMemo(
    () => Array.from(new Set(pathsKey.split("\n").filter(Boolean))),
    [pathsKey],
  );
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingPath, setActingPath] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [timelineCompare, setTimelineCompare] = useState<{
    path: string;
    rows: Array<{ key: string; before: number; after: number; delta: number }>;
    error?: string;
  } | null>(null);
  const [comparingPath, setComparingPath] = useState<string | null>(null);
  const [verification, setVerification] = useState<{
    path: string;
    result?: BackupVerification;
    error?: string;
  } | null>(null);
  const [verifyingPath, setVerifyingPath] = useState<string | null>(null);
  // Refs lock synchronously. React state alone is not enough to prevent two rapid
  // clicks from starting the same filesystem operation before the next render.
  const actionLockRef = useRef(false);
  const refreshLockRef = useRef(false);

  const refreshBackups = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (refreshLockRef.current) return false;
      refreshLockRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<BackupEntry[]>("list_backups", {
          profilePaths: stableProfilePaths,
          customPath: customPath || null,
        });
        setBackups(result);
        return true;
      } catch (cause) {
        const message = String(cause);
        setError(message);
        if (!options?.silent) toast.error(`Could not load backups: ${message}`);
        return false;
      } finally {
        refreshLockRef.current = false;
        setLoading(false);
      }
    },
    [stableProfilePaths, customPath],
  );

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  const filteredBackups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return backups;
    return backups.filter((backup) =>
      [
        backup.name,
        backup.displayName,
        backup.profileName,
        backup.backupType,
        backup.path,
        backup.originalPath,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [backups, search]);

  const totalBytes = useMemo(
    () => backups.reduce((total, backup) => total + backup.sizeBytes, 0),
    [backups],
  );
  const profileBackupCount = backups.filter((backup) => backup.backupType === "profile").length;

  async function openBackup(backup: BackupEntry) {
    if (actionLockRef.current || loading) return;
    actionLockRef.current = true;
    setActingPath(backup.path);
    try {
      await revealItemInDir(backup.path);
    } catch (cause) {
      toast.error(`Could not open the backup location: ${String(cause)}`);
    } finally {
      actionLockRef.current = false;
      setActingPath(null);
    }
  }

  async function compareWithCurrent(backup: BackupEntry) {
    if (backup.backupType !== "save" || comparingPath) return;
    setComparingPath(backup.path);
    setTimelineCompare({ path: backup.path, rows: [] });
    try {
      const [oldSave, currentSave] = await Promise.all([
        join(backup.path, "game.sii").then((gameSiiPath) =>
          invoke<SaveData>("load_save", { gameSiiPath }),
        ),
        join(backup.originalPath, "game.sii").then((gameSiiPath) =>
          invoke<SaveData>("load_save", { gameSiiPath }),
        ),
      ]);
      const hasComparableData = [
        "money",
        "xp",
        "level",
        "trucks_count",
        "drivers_count",
        "total_distance_km",
      ].some(
        (key) =>
          oldSave[key as keyof SaveData] != null && currentSave[key as keyof SaveData] != null,
      );
      setTimelineCompare({
        path: backup.path,
        rows: summarizeSaveDelta(oldSave, currentSave),
        error: hasComparableData
          ? undefined
          : "These two files do not contain comparable career metrics.",
      });
    } catch (cause) {
      setTimelineCompare({ path: backup.path, rows: [], error: String(cause) });
    } finally {
      setComparingPath(null);
    }
  }

  async function verifyBackup(backup: BackupEntry) {
    if (verifyingPath) return;
    setVerifyingPath(backup.path);
    setVerification({ path: backup.path });
    try {
      const result = await invoke<BackupVerification>("verify_backup", {
        backupPath: backup.path,
        profilePaths: stableProfilePaths,
        customPath: customPath || null,
      });
      setVerification({ path: backup.path, result });
    } catch (cause) {
      setVerification({ path: backup.path, error: String(cause) });
    } finally {
      setVerifyingPath(null);
    }
  }

  async function runPendingAction() {
    if (!pendingAction || actionLockRef.current || loading) return;
    if (readOnly) {
      toast.error(
        "Read Only protection is enabled. Turn it off before restoring or deleting a backup.",
      );
      return;
    }
    const currentAction = pendingAction;
    actionLockRef.current = true;
    setActingPath(currentAction.backup.path);
    try {
      const args = {
        backupPath: currentAction.backup.path,
        profilePaths: stableProfilePaths,
        customPath: customPath || null,
        readOnly,
      };
      const result = await invoke<BackupActionResult>(
        currentAction.kind === "restore" ? "restore_backup" : "delete_backup",
        args,
      );
      setPendingAction(null);
      toast.success(result.message);
      recordActivity(
        currentAction.kind === "restore" ? "backup-restored" : "backup-deleted",
        currentAction.backup.displayName || currentAction.backup.name,
      );
      const listRefreshed = await refreshBackups({ silent: true });
      let profileRefreshFailed = false;
      if (currentAction.kind === "restore") {
        try {
          await onRefreshProfiles();
        } catch {
          profileRefreshFailed = true;
        }
      }
      if (!listRefreshed || profileRefreshFailed) {
        const details = [
          !listRefreshed ? "the backup list" : null,
          profileRefreshFailed ? "the game profile list" : null,
        ]
          .filter(Boolean)
          .join(" and ");
        toast.error(
          `The backup operation succeeded, but ${details} could not be refreshed. Use Refresh list and check the profile list.`,
        );
      }
    } catch (cause) {
      const message = String(cause);
      // Keep the confirmation open after a failed operation so the user can inspect
      // the target and retry after fixing the issue. The backend validates before writes.
      toast.error(
        `${currentAction.kind === "restore" ? "Restore" : "Delete backup"} failed: ${message}`,
      );
    } finally {
      actionLockRef.current = false;
      setActingPath(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-6 pb-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/45 p-5 shadow-sm md:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-64 rounded-full bg-orange-500/[0.06] blur-3xl"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm shadow-primary/5">
              <DatabaseBackup className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                {language === "fa" ? "Roadbyte · ایمنی و بازیابی" : "Roadbyte · Safety & recovery"}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                {t("Backup Center")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t(
                  "Find, inspect, restore, or safely remove save and profile snapshots. Config backups stay beside config.cfg and are reported by Config Editor. Restore keeps the selected backup and protects an existing destination before replacing it.",
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 gap-2 rounded-xl border-border/60 bg-background/60"
            onClick={() => void refreshBackups()}
            disabled={loading || Boolean(actingPath)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("Refresh list")}
          </Button>
        </div>

        <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("Available backups")}
              </span>
              <Archive className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {loading ? "—" : backups.length}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("Save and profile snapshots")}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("Total backup size")}
              </span>
              <HardDrive className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {loading ? "—" : formatBytes(totalBytes)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("Calculated from backup files")}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("Profile snapshots")}
              </span>
              <UserRound className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {loading ? "—" : profileBackupCount}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("Full profile backup folders")}
            </p>
          </div>
        </div>
      </section>

      <SaveStoryPanel backups={backups} />

      <section className="rounded-2xl border border-border/60 bg-card/30 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <FileBox className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t("Backup library")}</h2>
            <Badge variant="outline" className="border-border/60 text-[10px]">
              {filteredBackups.length} {t("shown")}
            </Badge>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search
              className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/70"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search by save or profile…")}
              className="h-9 rounded-xl border-border/60 bg-background/60 pl-9 text-xs"
            />
          </div>
        </div>

        {readOnly && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-amber-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-semibold">{t("Read Only protection is enabled")}</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-100/70">
                {t(
                  "You can inspect backups, but Restore and Delete backup are disabled until Read Only is turned off.",
                )}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold">{t("Could not read the backup library")}</p>
              <p className="mt-1 break-words text-[11px] leading-5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p>{t("Scanning recognized Roadbyte backup folders…")}</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div className="mt-4 flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/25 px-5 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30 text-muted-foreground">
              <Archive className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {t(search.trim() ? "No backups match your search" : "No Roadbyte backups found")}
            </h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {search.trim()
                ? t("Try a different save or profile name, or clear the search field.")
                : "Save backups created by edits and deletions, plus profile backups, appear here. Config backups stay beside config.cfg and are reported by Config Editor."}
            </p>
            {search.trim() && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-lg"
                onClick={() => setSearch("")}
              >
                {t("Clear search")}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredBackups.map((backup) => {
              const isProfileBackup = backup.backupType === "profile";
              const isActing = actingPath === backup.path;
              const Icon = isProfileBackup ? UserRound : Archive;
              return (
                <article
                  key={backup.path}
                  className="group rounded-xl border border-border/60 bg-background/45 p-4 transition-all hover:border-primary/30 hover:bg-background/65 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isProfileBackup ? "border-sky-400/20 bg-sky-400/10 text-sky-300" : "border-primary/20 bg-primary/10 text-primary"}`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="max-w-full truncate text-sm font-semibold text-foreground">
                            {backup.displayName || backup.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={
                              isProfileBackup
                                ? "border-sky-400/25 bg-sky-400/[0.06] text-sky-300"
                                : "border-primary/25 bg-primary/[0.06] text-primary"
                            }
                          >
                            {t(isProfileBackup ? "Profile backup" : "Save backup")}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {isProfileBackup
                            ? t("Profile folder")
                            : `${language === "fa" ? "پروفایل" : "Profile"}: ${backup.profileName}`}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/80">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3 w-3" />
                            {formatBackupDate(backup.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <HardDrive className="h-3 w-3" />
                            {formatBytes(backup.sizeBytes)}
                          </span>
                          <span>
                            {backup.fileCount} {t("files")}
                          </span>
                        </div>
                        <p
                          className="mt-2 truncate font-mono text-[10px] text-muted-foreground/60"
                          title={backup.path}
                        >
                          {backup.path}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-lg border-border/60 bg-background/60 text-xs"
                        onClick={() => void verifyBackup(backup)}
                        disabled={loading || Boolean(verifyingPath)}
                      >
                        {verifyingPath === backup.path ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        {t(verifyingPath === backup.path ? "Verifying…" : "Verify & rehearse")}
                      </Button>
                      {!isProfileBackup && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 rounded-lg border-border/60 bg-background/60 text-xs"
                          onClick={() => void compareWithCurrent(backup)}
                          disabled={loading || Boolean(comparingPath)}
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" />
                          {t(comparingPath === backup.path ? "Comparing…" : "Compare timeline")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-lg border-border/60 bg-background/60 text-xs"
                        onClick={() => void openBackup(backup)}
                        disabled={loading || Boolean(actingPath)}
                      >
                        {isActing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FolderOpen className="h-3.5 w-3.5" />
                        )}
                        {t("Open location")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 gap-1.5 rounded-lg text-xs"
                        disabled={readOnly || loading || Boolean(actingPath)}
                        onClick={() => setPendingAction({ kind: "restore", backup })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {t("Restore")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-9 gap-1.5 rounded-lg text-xs"
                        disabled={readOnly || loading || Boolean(actingPath)}
                        onClick={() => setPendingAction({ kind: "delete", backup })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("Delete backup")}
                      </Button>
                    </div>
                  </div>
                  {verification?.path === backup.path && (
                    <div
                      role="status"
                      className={`mt-3 rounded-xl border p-3 text-xs ${verification.error ? "border-destructive/25 bg-destructive/[0.06] text-destructive" : "border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-700 dark:text-emerald-300"}`}
                    >
                      {verification.error ? (
                        <>
                          {t("Backup check failed")}: {verification.error}
                        </>
                      ) : verification.result ? (
                        <>
                          <p className="font-semibold">{t(verification.result.message)}</p>
                          <p className="mt-1 text-muted-foreground">
                            {verification.result.fileCount} {t("files")} ·{" "}
                            {formatBytes(verification.result.sizeBytes)}
                          </p>
                        </>
                      ) : (
                        t("Checking backup integrity and a temporary restore copy…")
                      )}
                    </div>
                  )}
                  {timelineCompare?.path === backup.path && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
                      <p className="text-xs font-semibold">
                        {t("Time Machine · backup → current save")}
                      </p>
                      {timelineCompare.error ? (
                        <p className="mt-2 break-all text-xs text-destructive">
                          {t("Could not compare")}: {timelineCompare.error}
                        </p>
                      ) : timelineCompare.rows.length ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {timelineCompare.rows.map((row) => (
                            <div
                              key={row.key}
                              className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 text-xs"
                            >
                              <span>{row.key.replace(/_/g, " ")}</span>
                              <span className="font-mono">
                                {row.before.toLocaleString()} → {row.after.toLocaleString()}{" "}
                                <b
                                  className={row.delta > 0 ? "text-emerald-400" : "text-amber-400"}
                                >
                                  ({row.delta > 0 ? "+" : ""}
                                  {row.delta.toLocaleString()})
                                </b>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t(
                            "No changes were found among the career metrics available in both saves.",
                          )}
                        </p>
                      )}
                      <button
                        type="button"
                        className="mt-2 text-[11px] text-muted-foreground underline"
                        onClick={() => setTimelineCompare(null)}
                      >
                        {t("Close comparison")}
                      </button>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t border-border/35 pt-3 text-[10px] text-muted-foreground/70">
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    <span className="shrink-0">Restore destination</span>
                    <span className="truncate font-mono" title={backup.originalPath}>
                      {backup.originalPath}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.035] p-4 text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-[11px] leading-5">
          Safety rule: restoring never deletes the selected backup. If the destination already
          exists, Roadbyte creates a separate safety backup of the current version before
          replacement. Backup deletion removes only the selected backup folder.
        </p>
      </div>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) =>
          !open && !actingPath && !actionLockRef.current && setPendingAction(null)
        }
      >
        <AlertDialogContent className="rounded-2xl border border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingAction?.kind === "restore" ? (
                <RotateCcw className="h-5 w-5 text-primary" />
              ) : (
                <Trash2 className="h-5 w-5 text-destructive" />
              )}
              {pendingAction?.kind === "restore"
                ? "Restore this backup?"
                : "Delete this backup permanently?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-6">
              {pendingAction?.kind === "restore" ? (
                <>
                  <span className="block">
                    Roadbyte will restore{" "}
                    <strong>{pendingAction.backup.displayName || pendingAction.backup.name}</strong>{" "}
                    to:
                  </span>
                  <code className="block break-all rounded-lg bg-muted/50 p-2 text-xs">
                    {pendingAction.backup.originalPath}
                  </code>
                  <span className="block">
                    Roadbyte validates the backup's primary SII file and checks for unsafe symbolic
                    links before making changes. If the backup is incomplete or unreadable, restore
                    is cancelled.
                  </span>
                  <span className="block">
                    The selected backup remains in the library. If a destination already exists, its
                    current contents are backed up before replacement.
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    This permanently deletes only the backup folder, not the live save/profile.
                  </span>
                  <code className="block break-all rounded-lg bg-muted/50 p-2 text-xs">
                    {pendingAction?.backup.path}
                  </code>
                  <span className="block">
                    This operation cannot be undone unless you have another copy of these files.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={loading || Boolean(actingPath)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
              disabled={readOnly || loading || Boolean(actingPath)}
              onClick={(event) => {
                event.preventDefault();
                void runPendingAction();
              }}
            >
              {actingPath ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : pendingAction?.kind === "restore" ? (
                <RotateCcw className="mr-2 h-4 w-4" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {actingPath
                ? "Working…"
                : pendingAction?.kind === "restore"
                  ? "Restore backup"
                  : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
