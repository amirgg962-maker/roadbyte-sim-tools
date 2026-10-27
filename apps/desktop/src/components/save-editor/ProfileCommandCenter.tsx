import { Activity, ArrowDownLeft, DatabaseBackup, Truck } from "lucide-react";
import { Button } from "ui";
import type { SaveData } from "../../types";
import { translate } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import { useSaveEditorStore } from "../../stores/save-editor";
import { evaluateSaveHealth } from "./save-health";

export function ProfileCommandCenter({
  saveName,
  saveData,
}: {
  saveName: string;
  saveData: SaveData;
}) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const profileName = useSaveEditorStore((state) => state.selectedProfile?.display_name);
  const health = evaluateSaveHealth(saveData);
  const statusText =
    health.level === "good"
      ? t("Ready for review")
      : health.level === "warning"
        ? t("Compatibility needs attention")
        : t("Some checks need attention");
  const statusStyle =
    health.level === "good"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-500/25 dark:text-emerald-300"
      : health.level === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-500/25 dark:text-amber-200"
        : "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:border-sky-500/25 dark:text-sky-200";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card/95 to-primary/[0.07] p-4 shadow-sm sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-20 size-52 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              {t("Profile command center")}
            </p>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}
            >
              {statusText}
            </span>
          </div>
          <h2 className="mt-2 truncate text-lg font-semibold text-foreground">
            {profileName || t("Selected profile")} <span className="text-muted-foreground">/</span>{" "}
            {saveName}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {health.level === "good"
              ? t("The loaded save passed the available checks. Back up before experimenting.")
              : health.level === "warning"
                ? t("Review the compatibility notice before editing or opening this save in game.")
                : t("Review the health details below before making changes to this save.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-lg"
            onClick={() => useSaveEditorStore.getState().setActiveWorkspace("backups")}
          >
            <DatabaseBackup className="h-4 w-4" />
            {t("Open Backup Center")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-2 rounded-lg"
            onClick={() =>
              document
                .getElementById("fleet-section")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <Truck className="h-4 w-4" />
            {t("Review fleet")}
            <ArrowDownLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
