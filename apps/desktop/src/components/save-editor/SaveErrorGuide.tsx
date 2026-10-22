import { Lightbulb, ShieldAlert } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { classifySaveError } from "./save-error-guidance";

export function SaveErrorGuide({ error }: { error: string }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const category = classifySaveError(error);
  const advice =
    category === "hmac"
      ? [
          "Keep this original save unchanged; verification failed before Roadbyte could safely read it.",
          "Check whether the game or Steam Cloud has another recent copy, and compare its timestamp and size.",
          "If you restore a copy, restore it to a separate test copy first and keep the original backup.",
        ]
      : category === "permission"
        ? [
            "Close ETS2 or ATS before retrying so the game is not holding the file open.",
            "Check that the selected profile folder still exists and your Windows account can read it.",
            "Keep the original error text below; do not change folder permissions broadly to work around it.",
          ]
        : category === "missing"
          ? [
              "Refresh the profile list and confirm the selected save still exists in the game folder.",
              "If the game moved to another drive, update Game Directory in Settings.",
              "Check whether Steam Cloud finished syncing before trying again.",
            ]
          : [
              "Keep the original save and any existing backups unchanged while diagnosing this error.",
              "Close the game, refresh the profile list, and retry once after confirming the save exists.",
              "If it continues, share the complete error text with the save format and game version.",
            ];

  return (
    <aside
      className="rounded-xl border border-sky-500/20 bg-sky-500/[0.045] p-4"
      aria-label={t("Troubleshooting suggestions")}
    >
      <div className="flex items-start gap-2.5">
        {category === "hmac" ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        ) : (
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t("What to try next")}</h3>
          <ol className="mt-2 list-inside list-decimal space-y-1.5 text-xs leading-5 text-muted-foreground">
            {advice.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}
