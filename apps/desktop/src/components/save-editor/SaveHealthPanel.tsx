import { AlertTriangle, CheckCircle2, ClipboardCheck, Info } from "lucide-react";
import type { SaveData } from "../../types";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { evaluateSaveHealth, type HealthLevel } from "./save-health";

const LEVEL_STYLES: Record<HealthLevel, string> = {
  good: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
  review: "border-sky-500/20 bg-sky-500/[0.05] text-sky-200",
  warning: "border-amber-500/25 bg-amber-500/[0.06] text-amber-200",
};

export function SaveHealthPanel({ saveData }: { saveData: SaveData }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const health = evaluateSaveHealth(saveData);
  const statusLabel =
    health.level === "warning"
      ? t("Review recommended")
      : health.level === "review"
        ? t("Some information is unavailable")
        : t("No issues found in available checks");

  return (
    <section
      className={`rounded-xl border p-4 ${LEVEL_STYLES[health.level]}`}
      aria-labelledby="save-health-title"
    >
      <div className="flex items-start gap-3">
        {health.level === "warning" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : health.level === "review" ? (
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="save-health-title" className="text-sm font-semibold">
              <ClipboardCheck className="me-2 inline h-4 w-4 align-[-3px]" />
              {t("Save Health Check")}
            </h3>
            <span className="text-xs font-medium">{statusLabel}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Read-only checks based on the data already loaded. No files are changed.")}
          </p>
          <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            {health.findings.map((finding) => (
              <li
                key={finding.key}
                className="rounded-lg border border-border/40 bg-background/35 p-2.5"
              >
                <p className="font-medium">{t(HEALTH_LABELS[finding.key])}</p>
                <p className="mt-1 text-muted-foreground">
                  {finding.key === "readability"
                    ? t("The save loaded and its data could be read.")
                    : finding.key === "compatibility"
                      ? (saveData.compatibility_warning ??
                        (saveData.game_version
                          ? `${t("Game version")}: ${saveData.game_version} · ${t("No compatibility warning was reported.")}`
                          : t("Game version is unknown; compatibility could not be confirmed.")))
                      : saveData.money_account?.trim() && saveData.experience_points?.trim()
                        ? t("Money and XP values were found.")
                        : t("One or more career values are missing from the loaded data.")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const HEALTH_LABELS = {
  readability: "Save readability",
  compatibility: "Game compatibility",
  "career-data": "Career data",
} as const;
