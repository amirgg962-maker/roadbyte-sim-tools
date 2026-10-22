import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Separator,
  Switch,
  FieldLabel,
  Button,
  useTheme,
} from "ui";
import { Sun, Moon, Monitor, ExternalLink, Folder, Settings, Shield } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { GamePathSelector } from "../save-editor/GamePathSelector";
import { UpdaterSettingsSection } from "./UpdaterSettingsSection";

interface AppVersionInfo {
  app_version: string;
  game_version: string | null;
  tested_game_version: string;
  compatibility_warning: string | null;
}

interface SettingsDialogProps {
  appInfo: AppVersionInfo | null;
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function SettingsDialog({ appInfo }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const {
    readOnly,
    setReadOnly,
    customGamePath,
    setCustomGamePath,
    isSettingsOpen,
    setIsSettingsOpen,
    language,
    setLanguage,
  } = useSettingsStore();
  const t = (text: string) => translate(language, text);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5 text-primary" />
            {t("Settings & Preferences")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Manage application theme, game directory, safety settings, and view version details.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sun className="h-4 w-4 text-muted-foreground" />
              {t("Appearance")}
            </h4>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
              <span className="text-sm font-medium">{t("Color Theme")}</span>
              <div className="flex gap-1.5">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setTheme(value)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t(label)}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              {language === "fa" ? "زبان" : "Language"}
            </h4>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {language === "fa" ? "زبان رابط کاربری" : "Interface language"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "fa"
                    ? "زبان نمایش متن‌های برنامه را انتخاب کنید."
                    : "Choose the language used in the application interface."}
                </p>
              </div>
              <select
                aria-label={language === "fa" ? "زبان رابط کاربری" : "Interface language"}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "fa")}
              >
                <option value="en">English</option>
                <option value="fa">فارسی</option>
              </select>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {t("Editor Safety")}
            </h4>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <FieldLabel
                  htmlFor="settings-readonly-switch"
                  className="text-sm font-medium cursor-pointer"
                >
                  {t("Read-only by default")}
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  {t("Prevents accidental edits on saves and config files unless toggled off")}
                </p>
              </div>
              <Switch
                id="settings-readonly-switch"
                checked={readOnly}
                onCheckedChange={setReadOnly}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Folder className="h-4 w-4 text-muted-foreground" />
              {t("Game Directory")}
            </h4>
            <GamePathSelector customPath={customGamePath} onPathChange={setCustomGamePath} />
          </section>

          <Separator />

          <UpdaterSettingsSection language={language} />

          <Separator />

          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              {t("About Roadbyte Sim Tools")}
            </h4>
            <div className="space-y-4 text-sm">
              <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl"
                />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <span className="text-xl font-black tracking-tight">R</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      {t("Creator & Brand")}
                    </p>
                    <h5 className="text-base font-bold tracking-tight text-foreground">
                      Roadbyte Sim Tools
                    </h5>
                    <p className="font-semibold text-foreground">
                      Roadbyte edition by Amircore <span className="text-primary">(@TGT_AM)</span>
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("Branding, visual redesign, and customization by Amircore (@TGT_AM).")}
                    </p>
                  </div>
                </div>
                <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-primary/15 pt-3 text-[11px]">
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-medium text-foreground">
                    Creator · @TGT_AM
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
                {appInfo ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("App version")}</span>
                      <span className="font-mono text-xs">v{appInfo.app_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("Tested game version")}</span>
                      <span className="font-mono text-xs">{appInfo.tested_game_version}</span>
                    </div>
                    {appInfo.game_version && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("Detected game version")}</span>
                        <span className="font-mono text-xs">{appInfo.game_version}</span>
                      </div>
                    )}
                    {appInfo.compatibility_warning && (
                      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                        {appInfo.compatibility_warning}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {t("Loading version information...")}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
