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
} from "ui";
import { FolderCog, DatabaseBackup, Truck } from "lucide-react";
import type { WorkspaceTab } from "../../stores/save-editor";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

interface FirstRunGuideProps {
  open: boolean;
  onLater: () => void;
  onComplete: () => void;
  onOpenGameSettings: () => void;
  onGoTo: (tab: WorkspaceTab) => void;
}

export function FirstRunGuide({
  open,
  onLater,
  onComplete,
  onOpenGameSettings,
  onGoTo,
}: FirstRunGuideProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onLater()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Welcome to Roadbyte")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "A short, safe setup guide. Nothing is changed in your game files during these steps.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ol className="space-y-3 py-2 text-sm">
          <li className="flex gap-3 rounded-lg border bg-card p-3">
            <FolderCog className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{t("Confirm the game folder if Roadbyte did not detect it automatically.")}</span>
          </li>
          <li className="flex gap-3 rounded-lg border bg-card p-3">
            <DatabaseBackup className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {t(
                "Open Backup Center to inspect available backups and verify one before restoring.",
              )}
            </span>
          </li>
          <li className="flex gap-3 rounded-lg border bg-card p-3">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {t(
                "Choose a save to inspect it. Read Only is enabled by default; edits require an explicit save confirmation.",
              )}
            </span>
          </li>
        </ol>
        <AlertDialogFooter className="flex-wrap sm:justify-between">
          <AlertDialogCancel onClick={onLater}>{t("Later")}</AlertDialogCancel>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onComplete();
                onOpenGameSettings();
              }}
            >
              {t("Set up game folder")}
            </Button>
            <AlertDialogAction
              onClick={() => {
                onComplete();
                onGoTo("backups");
              }}
            >
              {t("Open Backup Center")}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
