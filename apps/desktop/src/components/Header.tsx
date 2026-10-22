import { Button, Kbd, Badge } from "ui";
import {
  Search,
  Save,
  SlidersHorizontal,
  AlertTriangle,
  ChevronRight,
  Archive,
} from "lucide-react";
import type { ProfileInfo, SaveInfo } from "../types";
import type { WorkspaceTab } from "../stores/save-editor";
import { basename } from "../utils/path";
import { useSettingsStore } from "../stores/settings";
import { translate } from "../i18n";

interface AppVersionInfo {
  app_version: string;
  game_version: string | null;
  tested_game_version: string;
  compatibility_warning: string | null;
}

interface HeaderProps {
  activeWorkspace: WorkspaceTab;
  selectedProfile: ProfileInfo | null;
  selectedSave: SaveInfo | null;
  selectedConfigPath: string | null;
  appInfo: AppVersionInfo | null;
  onOpenCommandPalette: () => void;
}

export function Header({
  activeWorkspace,
  selectedProfile,
  selectedSave,
  selectedConfigPath,
  appInfo,
  onOpenCommandPalette,
}: HeaderProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const configFilename = selectedConfigPath ? basename(selectedConfigPath) : null;

  return (
    <header className="h-14 px-6 flex items-center justify-between bg-background/40 backdrop-blur-xl shrink-0 select-none">
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0 font-medium">
        {activeWorkspace === "saves" ? (
          <>
            <Save className="h-4 w-4 text-amber-500 shrink-0" />
            {selectedProfile ? (
              <span className="font-semibold text-foreground truncate">
                {selectedProfile.display_name}
              </span>
            ) : (
              <span>{t("No profile selected")}</span>
            )}
            {selectedSave && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <span className="font-semibold text-primary truncate bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {selectedSave.save_name}
                </span>
              </>
            )}
          </>
        ) : activeWorkspace === "config" ? (
          <>
            <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground">{t("Game Config")}</span>
            {configFilename && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <span className="font-mono text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {configFilename}
                </span>
              </>
            )}
          </>
        ) : (
          <>
            <Archive className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground">{t("Backup Center")}</span>
            {selectedProfile && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <span className="truncate text-muted-foreground">
                  {selectedProfile.display_name}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {appInfo?.compatibility_warning && (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5 text-[11px] font-normal rounded-lg"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("Game Version Warning")}
          </Badge>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          className="gap-2 text-xs text-muted-foreground hover:text-foreground bg-muted/20 border-border/40 hover:bg-accent/40 rounded-lg h-8 shadow-xs"
        >
          <Search className="h-3.5 w-3.5 opacity-70" />
          <span className="font-normal">{t("Search or type a command...")}</span>
          <Kbd className="text-[10px] bg-background/80 border border-border/40 font-mono">
            Ctrl+K
          </Kbd>
        </Button>
      </div>
    </header>
  );
}
