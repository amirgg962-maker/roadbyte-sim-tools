import {
  Activity,
  AlertTriangle,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  FileText,
  Fuel,
  Gauge,
  Layers3,
  MapPin,
  Route,
  ShieldCheck,
  Trophy,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { SaveData } from "../../types";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import { SaveHealthPanel } from "./SaveHealthPanel";
import { ProfileCommandCenter } from "./ProfileCommandCenter";
import { ActivityTimeline } from "./ActivityTimeline";

interface OverviewStatsProps {
  saveData: SaveData;
}

type Accent = "orange" | "emerald" | "amber" | "cyan" | "violet" | "blue";

const ACCENTS: Record<Accent, { icon: string; iconBg: string; glow: string; bar: string }> = {
  orange: {
    icon: "text-primary",
    iconBg: "border-primary/20 bg-primary/10",
    glow: "from-primary/10",
    bar: "bg-primary",
  },
  emerald: {
    icon: "text-emerald-400",
    iconBg: "border-emerald-500/20 bg-emerald-500/10",
    glow: "from-emerald-500/[0.08]",
    bar: "bg-emerald-400",
  },
  amber: {
    icon: "text-amber-400",
    iconBg: "border-amber-500/20 bg-amber-500/10",
    glow: "from-amber-500/[0.08]",
    bar: "bg-amber-400",
  },
  cyan: {
    icon: "text-cyan-400",
    iconBg: "border-cyan-500/20 bg-cyan-500/10",
    glow: "from-cyan-500/[0.08]",
    bar: "bg-cyan-400",
  },
  violet: {
    icon: "text-violet-400",
    iconBg: "border-violet-500/20 bg-violet-500/10",
    glow: "from-violet-500/[0.08]",
    bar: "bg-violet-400",
  },
  blue: {
    icon: "text-sky-400",
    iconBg: "border-sky-500/20 bg-sky-500/10",
    glow: "from-sky-500/8",
    bar: "bg-sky-400",
  },
};

function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatNumericText(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? formatNumber(parsed) : String(value);
}

function formatMoney(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })} €`;
}

function formatBool(value: boolean | null | undefined): string {
  if (value == null) return "Not available";
  return value ? "Yes" : "No";
}

function formatTime(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "—";
  const totalMinutes = Math.floor(minutes);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const remainingMinutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (totalHours > 0) return `${totalHours}h ${remainingMinutes}m`;
  return `${remainingMinutes}m`;
}

function formatDate(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "Not available";
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent: Accent;
}) {
  const style = ACCENTS[accent];
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/45 bg-card/55 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/75">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} via-transparent to-transparent opacity-80`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {label}
          </p>
          <p className="break-words font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[1.7rem]">
            {value}
          </p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${style.iconBg} ${style.icon}`}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </div>
      </div>
      <p className="relative mt-3 truncate text-xs text-muted-foreground/80">{detail}</p>
      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-muted/70">
        <div
          className={`h-full w-1/3 rounded-full opacity-70 transition-all duration-300 group-hover:w-2/3 ${style.bar}`}
        />
      </div>
    </article>
  );
}

function ActivityTile({
  label,
  value,
  icon: Icon,
  detail,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  detail: string;
  accent: Accent;
}) {
  const style = ACCENTS[accent];
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border/35 bg-background/35 p-3.5 transition-colors hover:border-border/70 hover:bg-background/55">
      <div className={`mt-0.5 rounded-lg p-2 ${style.iconBg} ${style.icon}`}>
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 break-words font-mono text-lg font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground/75">{detail}</p>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  icon: Icon,
  badge = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  badge?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/30 py-3 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
        <span>{label}</span>
      </div>
      {badge ? (
        <span className="max-w-[60%] rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-1 text-right text-[11px] font-medium text-primary">
          {value}
        </span>
      ) : (
        <span className="max-w-[62%] break-words text-right text-xs font-medium text-foreground">
          {value}
        </span>
      )}
    </div>
  );
}

export function OverviewStats({ saveData, saveName }: OverviewStatsProps & { saveName: string }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const truckCount = saveData.trucks_count ?? saveData.trucks.length;
  const saveFormat = saveData.was_compressed ? "Compressed SCS" : "Plain-text SII";
  const versionLabel = saveData.game_version
    ? `${language === "fa" ? "بازی" : "Game"} ${saveData.game_version}`
    : language === "fa"
      ? "نسخهٔ بازی نامشخص"
      : "Game version unknown";

  return (
    <div className="space-y-5">
      <ProfileCommandCenter saveData={saveData} saveName={saveName} />
      {saveData.compatibility_warning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4 shadow-sm">
          <div className="mt-0.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-300">
              {language === "fa" ? "هشدار سازگاری · " : "Compatibility notice · "}
              {versionLabel}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              {saveData.compatibility_warning}
            </p>
          </div>
        </div>
      )}

      <SaveHealthPanel saveData={saveData} />

      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card/95 to-primary/[0.07] p-5 shadow-sm sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-64 rounded-full bg-orange-500/[0.04] blur-3xl"
        />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-inner shadow-primary/10">
              <Gauge className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                {language === "fa" ? "Roadbyte / تحلیل ذخیره" : "Roadbyte / Save analytics"}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {language === "fa" ? "نمای کلی پروفایل" : "Profile Overview"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {language === "fa"
                  ? "نمایی از پیشرفت، فعالیت و اطلاعات فایل ذخیره."
                  : "A clear snapshot of your progress, activity, and save-file metadata."}
              </p>
            </div>
          </div>
          <div className="relative flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/45 px-2.5 py-1.5 text-[11px] font-medium text-foreground/90">
              <Database className="h-3.5 w-3.5 text-primary" />
              {saveFormat}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/45 px-2.5 py-1.5 text-[11px] font-medium text-foreground/90">
              <Layers3 className="h-3.5 w-3.5 text-primary" />
              {saveData.mods.length.toLocaleString()}{" "}
              {language === "fa" ? "افزونه / DLC" : "mods / DLCs"}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("Career Snapshot")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Key values from the selected save.")}
            </p>
          </div>
          <span className="hidden rounded-full border border-border/40 bg-card/45 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
            {language === "fa" ? "اطلاعات زندهٔ ذخیره" : "Live save data"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <MetricCard
            label={t("Account balance")}
            value={formatMoney(saveData.money_account)}
            detail={t("Funds available in this profile")}
            icon={Wallet}
            accent="emerald"
          />
          <MetricCard
            label={t("Driver level")}
            value={formatNumericText(saveData.level)}
            detail={t("Current career progression")}
            icon={Award}
            accent="orange"
          />
          <MetricCard
            label={t("Experience points")}
            value={formatNumericText(saveData.experience_points)}
            detail={language === "fa" ? "XP ثبت‌شده در این ذخیره" : "XP recorded in this save"}
            icon={Trophy}
            accent="amber"
          />
          <MetricCard
            label={t("Owned trucks")}
            value={formatNumericText(truckCount)}
            detail={
              saveData.drivers_count == null
                ? language === "fa"
                  ? "تعداد رانندگان در دسترس نیست"
                  : "Driver count unavailable"
                : `${formatNumericText(saveData.drivers_count)} ${language === "fa" ? "رانندهٔ استخدام‌شده" : `hired driver${saveData.drivers_count === 1 ? "" : "s"}`}`
            }
            icon={Truck}
            accent="cyan"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
        <section className="rounded-2xl border border-border/40 bg-card/45 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 text-cyan-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t("Journey & Activity")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {language === "fa"
                    ? "فعالیت ثبت‌شده در طول مسیر رانندگی شما."
                    : "Recorded activity across your driving career."}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-border/40 bg-background/40 px-2 py-1 text-[10px] font-medium text-muted-foreground">
              {language === "fa" ? "آمار" : "Statistics"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <ActivityTile
              label={t("Play time")}
              value={formatTime(saveData.game_time)}
              detail={t("Total recorded time")}
              icon={Clock}
              accent="orange"
            />
            <ActivityTile
              label={t("Distance driven")}
              value={
                saveData.total_distance_km == null
                  ? "—"
                  : `${formatNumber(saveData.total_distance_km, 1)} km`
              }
              detail={t("Career distance")}
              icon={Route}
              accent="cyan"
            />
            <ActivityTile
              label={t("Fuel consumed")}
              value={
                saveData.total_fuel_litres == null
                  ? "—"
                  : `${formatNumber(saveData.total_fuel_litres, 1)} L`
              }
              detail={t("Total fuel used")}
              icon={Fuel}
              accent="amber"
            />
            <ActivityTile
              label={t("Cities visited")}
              value={formatNumber(saveData.visited_cities_count)}
              detail={
                language === "fa" ? "مکان‌های نقشه که به آن‌ها رسیده‌اید" : "Mapped locations reached"
              }
              icon={MapPin}
              accent="emerald"
            />
            <ActivityTile
              label={t("Discoveries")}
              value={formatNumber(saveData.discovered_items)}
              detail={language === "fa" ? "مکان‌های کشف‌شده در بازی" : "World discoveries recorded"}
              icon={Compass}
              accent="violet"
            />
            <ActivityTile
              label={t("Achievements")}
              value={formatNumber(saveData.achieved_feats)}
              detail={language === "fa" ? "نقاط عطف کارنامه" : "Career milestones"}
              icon={CheckCircle2}
              accent="blue"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border/40 bg-card/45 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <div className="mb-2 flex items-start gap-3">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("Save File Details")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {language === "fa"
                  ? "اطلاعات فایل و وضعیت سازگاری."
                  : "File metadata and compatibility context."}
              </p>
            </div>
          </div>
          <div className="divide-y-0">
            <MetaRow
              label={t("Save format")}
              value={saveData.was_compressed ? "SCS compressed" : "SII plaintext"}
              icon={Database}
              badge
            />
            <MetaRow
              label={t("Created")}
              value={formatDate(saveData.file_time)}
              icon={CalendarClock}
            />
            <MetaRow
              label={t("New game")}
              value={formatBool(saveData.new_game)}
              icon={CheckCircle2}
            />
            <MetaRow
              label={t("Game version")}
              value={saveData.game_version ?? t("Not detected")}
              icon={ShieldCheck}
            />
            <MetaRow
              label={t("Active mods / DLCs")}
              value={`${formatNumber(saveData.mods.length)} ${language === "fa" ? "فعال" : "active"}`}
              icon={Layers3}
            />
            {saveData.save_version != null && (
              <MetaRow
                label={t("Save schema")}
                value={String(saveData.save_version)}
                icon={FileText}
              />
            )}
            <MetaRow
              label={t("Home city")}
              value={saveData.hq_city ?? t("Not available")}
              icon={MapPin}
            />
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="text-xs font-medium text-emerald-300">{t("Save data is available")}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {language === "fa"
                  ? "پیش از تغییر این فایل، اطلاعات بالا را بررسی کنید."
                  : "Review the details above before making any changes to this file."}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-border/35 pt-4">
            <ActivityTimeline saveName={saveName} />
          </div>
        </section>
      </div>
    </div>
  );
}
