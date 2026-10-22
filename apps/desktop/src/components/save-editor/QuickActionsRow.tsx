import { Button } from "ui";
import { MapPin, Sparkles, Wrench, Fuel, Zap, LockKeyhole } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

interface QuickActionsRowProps {
  readOnly: boolean;
  onUnlock: () => void;
  onMaxSkills: () => void;
  onRepair: () => void;
  onRefuel: () => void;
}

export function QuickActionsRow({
  readOnly,
  onUnlock,
  onMaxSkills,
  onRepair,
  onRefuel,
}: QuickActionsRowProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border/40 bg-card/55 p-5 shadow-sm shadow-black/10 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 size-52 rounded-full bg-primary/[0.06] blur-3xl"
      />

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary">
              <Zap className="size-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">
                {t("Quick Actions")}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {language === "fa"
                  ? "ابزارهای کاربردی برای کامیون‌ها و پروفایل راننده."
                  : "Handy tools for your trucks and driver profile."}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-border/50 bg-background/35 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
            {language === "fa" ? "۴ ابزار" : "4 TOOLS"}
          </span>
        </div>

        {readOnly && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2.5 text-amber-300/90">
            <LockKeyhole className="size-3.5 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              {language === "fa"
                ? "حالت فقط‌خواندنی روشن است. برای استفاده از این عملیات، حالت ویرایش را فعال کنید."
                : "Read Only is on. Switch to Edit Mode to use these actions."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Button
            variant="outline"
            onClick={onUnlock}
            disabled={readOnly}
            className="group h-auto min-h-[78px] w-full justify-start gap-3 rounded-xl border-border/45 bg-background/30 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_8px_22px_rgba(255,122,0,0.06)] disabled:translate-y-0 disabled:shadow-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/[0.08] text-amber-400 transition-colors group-hover:bg-amber-500/[0.13]">
              <MapPin className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">
                {t("Unlock Cities")}
              </span>
              <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                {t("Open city access in this save")}
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={onMaxSkills}
            disabled={readOnly}
            className="group h-auto min-h-[78px] w-full justify-start gap-3 rounded-xl border-border/45 bg-background/30 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_8px_22px_rgba(255,122,0,0.06)] disabled:translate-y-0 disabled:shadow-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-purple-400/15 bg-purple-400/[0.08] text-purple-300 transition-colors group-hover:bg-purple-400/[0.13]">
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">{t("Max Skills")}</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                {t("Maximize driver skills")}
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={onRepair}
            disabled={readOnly}
            className="group h-auto min-h-[78px] w-full justify-start gap-3 rounded-xl border-border/45 bg-background/30 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_8px_22px_rgba(255,122,0,0.06)] disabled:translate-y-0 disabled:shadow-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300 transition-colors group-hover:bg-emerald-400/[0.13]">
              <Wrench className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">{t("Repair All")}</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                {t("Restore truck condition")}
              </span>
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={onRefuel}
            disabled={readOnly}
            className="group h-auto min-h-[78px] w-full justify-start gap-3 rounded-xl border-border/45 bg-background/30 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-[0_8px_22px_rgba(255,122,0,0.06)] disabled:translate-y-0 disabled:shadow-none"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/[0.08] text-sky-300 transition-colors group-hover:bg-sky-400/[0.13]">
              <Fuel className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">{t("Refuel All")}</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                {t("Refill all owned trucks")}
              </span>
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}
