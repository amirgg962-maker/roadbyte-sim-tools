import type { SaveData } from "../../types";
import { buildCareerMilestones } from "../../utils/roadbyte-workbench.js";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { Award, MapPinned, Route, Truck } from "lucide-react";

const labels: Record<string, string> = {
  "first-delivery": "First thousand XP",
  "city-explorer": "City explorer",
  "fleet-owner": "Fleet owner",
  "achievement-hunter": "First achievement",
  "road-veteran": "10,000 km on the road",
};

const icons = [Award, MapPinned, Truck, Award, Route];

export function CareerConstellation({ saveData }: { saveData: SaveData }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const milestones = buildCareerMilestones(saveData);

  return (
    <section
      className="rounded-2xl border border-border/45 bg-card/45 p-4 sm:p-5"
      aria-labelledby="career-constellation-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Roadbyte · Career
          </p>
          <h3 id="career-constellation-title" className="mt-1 text-sm font-semibold">
            {t("Career Constellation")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Milestones inferred from values present in this save.")}
          </p>
        </div>
        <span className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          {t("Read only")}
        </span>
      </div>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {milestones.map((milestone, index) => {
          const Icon = icons[index] ?? Award;
          return (
            <li
              key={milestone.key}
              className="relative rounded-xl border border-border/45 bg-background/35 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${milestone.reached ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/60 text-muted-foreground"}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {milestone.reached === null
                    ? t("Unknown")
                    : milestone.reached
                      ? t("Reached")
                      : t("In progress")}
                </span>
              </div>
              <p className="mt-3 text-xs font-medium">
                {t(labels[milestone.key] ?? milestone.key)}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                <div
                  className={`h-full rounded-full ${milestone.reached ? "bg-emerald-400" : "bg-primary"}`}
                  style={{ width: `${(milestone.progress ?? 0) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
