import { Button, Input, Kbd, Label } from "ui";
import { Euro, Trophy, Save, LockKeyhole, ShieldCheck, WalletCards, Info } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

interface EditValuesFormProps {
  moneyInput: string;
  xpInput: string;
  onMoneyChange: (value: string) => void;
  onXpChange: (value: string) => void;
  onSave: () => void;
  readOnly: boolean;
}

export function EditValuesForm({
  moneyInput,
  xpInput,
  onMoneyChange,
  onXpChange,
  onSave,
  readOnly,
}: EditValuesFormProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  return (
    <form
      className="relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card/95 via-card/75 to-background/80 p-5 shadow-sm shadow-black/20 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-28 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/4 size-48 rounded-full bg-orange-500/[0.04] blur-3xl"
      />

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_22px_rgba(255,122,0,0.08)]">
              <WalletCards className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">
                {language === "fa" ? "موجودی و امتیاز تجربه" : "Account Balance & Experience"}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {language === "fa"
                  ? "موجودی و امتیازهای پیشرفت فایل ذخیره را تنظیم کنید."
                  : "Adjust the funds and progression points for the selected save."}
              </p>
            </div>
          </div>

          <span
            className={
              readOnly
                ? "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-amber-400"
                : "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-emerald-400"
            }
          >
            {readOnly ? <LockKeyhole className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            {t(readOnly ? "READ ONLY" : "EDIT MODE")}
          </span>
        </div>

        {readOnly && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3 text-amber-300/90">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold">
                {language === "fa" ? "ویرایش موقتاً متوقف است" : "Editing is safely paused"}
              </p>
              <p className="text-[11px] leading-relaxed text-amber-200/65">
                {language === "fa"
                  ? "برای فعال‌کردن فیلدها و عملیات سریع، حالت فقط‌خواندنی را از پایینِ سمت چپ خاموش کنید."
                  : "Turn off Read Only in the lower-left corner to enable fields and quick actions."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="group/field space-y-2 rounded-xl border border-border/45 bg-background/35 p-3.5 transition-colors focus-within:border-primary/45 focus-within:bg-background/60">
            <Label
              htmlFor="money"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Euro className="size-4" />
              </span>
              <span>{t("Money balance")}</span>
              <span className="ml-auto rounded-md border border-border/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/75">
                EUR
              </span>
            </Label>
            <Input
              id="money"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={moneyInput}
              onChange={(e) => onMoneyChange(e.target.value)}
              disabled={readOnly}
              placeholder={t("Enter money amount")}
              className="h-11 rounded-lg border-border/45 bg-background/55 font-mono text-sm tabular-nums focus-visible:border-primary/50 focus-visible:ring-primary/20 focus-visible:ring-offset-0 disabled:bg-muted/20"
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground/70">
              {language === "fa"
                ? "موجودی قابل‌استفاده در پروفایل شما"
                : "Available funds in your profile"}
            </p>
          </div>

          <div className="group/field space-y-2 rounded-xl border border-border/45 bg-background/35 p-3.5 transition-colors focus-within:border-primary/45 focus-within:bg-background/60">
            <Label
              htmlFor="xp"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Trophy className="size-4" />
              </span>
              <span>{t("Experience points")}</span>
              <span className="ml-auto rounded-md border border-border/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/75">
                XP
              </span>
            </Label>
            <Input
              id="xp"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={xpInput}
              onChange={(e) => onXpChange(e.target.value)}
              disabled={readOnly}
              placeholder={t("Enter experience points")}
              className="h-11 rounded-lg border-border/45 bg-background/55 font-mono text-sm tabular-nums focus-visible:border-primary/50 focus-visible:ring-primary/20 focus-visible:ring-offset-0 disabled:bg-muted/20"
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground/70">
              {language === "fa"
                ? "برای پیشرفت راننده استفاده می‌شود"
                : "Used for your driver progression"}
            </p>
          </div>

          <Button
            type="submit"
            disabled={readOnly}
            size="lg"
            className="h-11 gap-2 rounded-xl px-5 font-semibold shadow-[0_4px_20px_rgba(255,122,0,0.13)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(255,122,0,0.2)] disabled:translate-y-0 disabled:shadow-none lg:min-w-[180px]"
          >
            <Save className="size-4" />
            <span>{t("Save Values")}</span>
            <Kbd className="ml-1 border border-primary-foreground/20 bg-primary-foreground/15 px-1.5 text-[10px] text-primary-foreground">
              Ctrl+S
            </Kbd>
          </Button>
        </div>

        <div className="flex items-start gap-2 border-t border-border/35 pt-3 text-[11px] leading-relaxed text-muted-foreground/75">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
          <p>
            {t("Changes are written to the currently selected save when you press Save Values.")}
          </p>
        </div>
      </div>
    </form>
  );
}
