import { useEffect, useMemo, useState } from "react";
import { Archive, Clock3, History } from "lucide-react";
import type { BackupEntry } from "../../types";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { buildSaveStory } from "../../utils/roadbyte-workbench.js";
import { readActivityLog, subscribeToActivityLog } from "../../utils/activity-log";

const activityLabels: Record<string, string> = {
  "values-edited": "Money or XP updated",
  "cities-unlocked": "Cities unlocked",
  "skills-maxed": "Skills maximized",
  "trucks-repaired": "Trucks repaired",
  "trucks-refueled": "Trucks refueled",
  "save-renamed": "Save renamed",
  "save-copied": "Save copy created",
  "save-deleted": "Save deleted",
  "backup-restored": "Backup restored",
  "backup-deleted": "Backup deleted",
};

export function SaveStoryPanel({ backups }: { backups: BackupEntry[] }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const [activity, setActivity] = useState(() => readActivityLog());
  useEffect(() => subscribeToActivityLog(() => setActivity(readActivityLog())), []);
  const story = useMemo(() => buildSaveStory(backups, activity).slice(0, 10), [backups, activity]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card/30 p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
          <History className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{t("Save Story")}</h2>
          <p className="text-[11px] text-muted-foreground">
            {t("A device-local timeline of Roadbyte actions and save backups.")}
          </p>
        </div>
      </div>
      {story.length ? (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {story.map((entry) => (
            <li
              key={entry.id}
              className="flex min-w-0 items-start gap-2.5 rounded-xl border border-border/40 bg-background/40 p-3"
            >
              <span className="mt-0.5 text-primary">
                {entry.kind === "backup" ? (
                  <Archive className="h-4 w-4" />
                ) : (
                  <Clock3 className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {t(
                    entry.kind === "backup"
                      ? "Backup snapshot created"
                      : (activityLabels[entry.kind] ?? "Activity recorded"),
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {entry.saveName}
                </p>
                <time
                  className="mt-1 block text-[10px] text-muted-foreground"
                  dateTime={new Date(entry.timestamp).toISOString()}
                >
                  {new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(entry.timestamp)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">
          {t("No story events are recorded on this device yet.")}
        </p>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        {t(
          "Activity history is stored on this device and may not include changes made directly in the game.",
        )}
      </p>
    </section>
  );
}
