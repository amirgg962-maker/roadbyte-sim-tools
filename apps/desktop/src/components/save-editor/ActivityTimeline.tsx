import { useEffect, useState } from "react";
import { Clock3, History } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import {
  readActivityLog,
  subscribeToActivityLog,
  type ActivityEntry,
} from "../../utils/activity-log";

const ACTIVITY_LABELS: Record<ActivityEntry["kind"], string> = {
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

export function ActivityTimeline({ saveName }: { saveName: string }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const [entries, setEntries] = useState<ActivityEntry[]>(() => readActivityLog());

  useEffect(() => subscribeToActivityLog(() => setEntries(readActivityLog())), []);

  const recentEntries = entries.slice(0, 5);

  return (
    <section className="rounded-2xl border border-border/75 bg-card/45 p-4 shadow-sm sm:p-5 dark:border-border/40">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-2.5 text-violet-700 dark:border-violet-500/20 dark:text-violet-300">
          <History className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{t("Recent activity")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Recent changes recorded on this device.")} · {saveName}
          </p>
          {recentEntries.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {recentEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2.5">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {t(ACTIVITY_LABELS[entry.kind])}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {entry.saveName}
                    </p>
                    <time
                      className="mt-0.5 block text-[11px] text-muted-foreground"
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
            <p className="mt-4 rounded-lg border border-dashed border-border/75 bg-background/25 p-3 text-xs leading-5 text-muted-foreground dark:border-border/45">
              {t("No activity has been recorded for this save yet.")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
