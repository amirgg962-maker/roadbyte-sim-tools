import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { CircleAlert, CircleCheck, Download, RefreshCw } from "lucide-react";
import { Button } from "ui";
import type { AppLanguage } from "../../stores/settings";
import { translate } from "../../i18n";

interface UpdaterSettingsSectionProps {
  language: AppLanguage;
}

export function UpdaterSettingsSection({ language }: UpdaterSettingsSectionProps) {
  const [update, setUpdate] = useState<Update | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const t = (text: string) => translate(language, text);

  useEffect(() => () => {
    if (update) void update.close();
  }, [update]);

  if (!isTauri()) return null;

  const checkForUpdates = async () => {
    setIsChecking(true);
    setStatus(null);
    setProgress(null);
    setUpdate(null);
    try {
      const availableUpdate = await check();
      if (availableUpdate) {
        setUpdate(availableUpdate);
      } else {
        setStatus({ kind: "success", text: t("You are using the latest version.") });
      }
    } catch (error) {
      setStatus({ kind: "error", text: `${t("Could not check for updates")}: ${String(error)}` });
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!update) return;
    setIsInstalling(true);
    setStatus(null);
    setProgress(t("Downloading update…"));
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Finished") setProgress(t("Installing update…"));
      });
      setStatus({ kind: "success", text: t("Update installed. Restarting…") });
      await relaunch();
    } catch (error) {
      setStatus({ kind: "error", text: `${t("Update failed")}: ${String(error)}` });
      setIsInstalling(false);
      setProgress(null);
    }
  };

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Download className="h-4 w-4 text-muted-foreground" />
        {t("Software updates")}
      </h4>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          {t("Check for a new Roadbyte version. Updates are installed only after you choose Download and install.")}
        </p>
        {update && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold">
              {t("Update available")}: <span className="font-mono">v{update.version}</span>
            </p>
            {update.body && (
              <div>
                <p className="mb-1 text-xs font-medium">{t("Release notes")}</p>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{update.body}</p>
              </div>
            )}
            <Button size="sm" className="gap-2" disabled={isInstalling} onClick={() => void installUpdate()}>
              <Download className="h-4 w-4" />
              {isInstalling ? t("Downloading and installing…") : t("Download and install")}
            </Button>
          </div>
        )}
        {progress && <p role="status" className="text-xs text-muted-foreground">{progress}</p>}
        {status && (
          <p role="status" className={`flex items-start gap-2 text-xs ${status.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            {status.kind === "error" ? <CircleAlert className="h-4 w-4 shrink-0" /> : <CircleCheck className="h-4 w-4 shrink-0" />}
            <span>{status.text}</span>
          </p>
        )}
        <Button variant="outline" size="sm" className="gap-2" disabled={isChecking || isInstalling} onClick={() => void checkForUpdates()}>
          <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? t("Checking for updates…") : t("Check for updates")}
        </Button>
      </div>
    </section>
  );
}
