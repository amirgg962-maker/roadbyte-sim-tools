import { AlertCircle, Fuel, Gauge, Route, Truck, Wrench } from "lucide-react";
import type { TruckInfo } from "../../types";
import type { ReactNode } from "react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

type WearPart = "Engine" | "Transmission" | "Cabin" | "Chassis";

function cleanLicensePlate(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\|(\w+)/g, (_, code: string) => ` | ${code.charAt(0).toUpperCase()}${code.slice(1)}`)
    .trim();
}

function asPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value * 100));
}

function formatMetric(value: number | null | undefined, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
}

function fuelTone(percent: number): string {
  if (percent <= 15) return "bg-red-500";
  if (percent <= 35) return "bg-amber-400";
  return "bg-cyan-400";
}

function wearTone(percent: number): { bar: string; text: string; label: string } {
  if (percent < 5) return { bar: "bg-emerald-400", text: "text-emerald-400", label: "Excellent" };
  if (percent < 20) return { bar: "bg-lime-400", text: "text-lime-400", label: "Good" };
  if (percent < 45) return { bar: "bg-amber-400", text: "text-amber-400", label: "Monitor" };
  return { bar: "bg-red-400", text: "text-red-400", label: "High wear" };
}

function ProgressLine({
  label,
  value,
  mode,
}: {
  label: string;
  value: number | null | undefined;
  mode: "fuel" | "wear";
}) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const percent = asPercent(value);
  const tone = mode === "wear" && percent != null ? wearTone(percent) : null;
  const fillClass =
    mode === "fuel" && percent != null
      ? fuelTone(percent)
      : (tone?.bar ?? "bg-muted-foreground/40");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span
          className={`font-mono text-[11px] font-semibold tabular-nums ${tone?.text ?? "text-foreground/90"}`}
        >
          {percent == null ? "—" : `${percent.toFixed(1)}%`}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted/75"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${fillClass}`}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      {tone && mode === "wear" && <p className={`text-[10px] ${tone.text}`}>{t(tone.label)}</p>}
    </div>
  );
}

function TruckCard({ truck }: { truck: TruckInfo }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const fuelPercent = asPercent(truck.fuel_relative);
  const wearItems: Array<{ label: WearPart; value: number | null }> = [
    { label: "Engine", value: truck.engine_wear },
    { label: "Transmission", value: truck.transmission_wear },
    { label: "Cabin", value: truck.cabin_wear },
    { label: "Chassis", value: truck.chassis_wear },
  ];
  const hasWearData = wearItems.some((item) => item.value != null);

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/45 bg-card/55 shadow-sm transition-all duration-200 hover:border-primary/25 hover:bg-card/75">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-primary/[0.06] blur-3xl transition-opacity group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between gap-3 border-b border-border/35 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Truck className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              {language === "fa" ? "کامیون" : "Vehicle"} {String(truck.index + 1).padStart(2, "0")}
            </p>
            <h4 className="mt-1 truncate text-sm font-semibold text-foreground">
              {language === "fa" ? "کامیون" : "Truck"} {truck.index + 1}
            </h4>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {truck.license_plate
                ? cleanLicensePlate(truck.license_plate)
                : t("License plate unavailable")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/40 bg-background/45 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          {truck.odometer_km == null ? t("Mileage N/A") : `${formatMetric(truck.odometer_km)} km`}
        </span>
      </div>

      <div className="relative grid gap-4 p-4 sm:p-5 md:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4 rounded-xl border border-border/35 bg-background/30 p-3.5">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-cyan-400" />
            <p className="text-xs font-semibold text-foreground">{t("Fuel level")}</p>
            <span className="ml-auto font-mono text-sm font-semibold text-foreground tabular-nums">
              {fuelPercent == null ? "—" : `${Math.round(fuelPercent)}%`}
            </span>
          </div>
          <ProgressLine label={t("Tank remaining")} value={truck.fuel_relative} mode="fuel" />
          <div className="flex items-start gap-2 border-t border-border/35 pt-3">
            <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {truck.odometer_km == null
                ? t("Mileage data is not present in this save.")
                : `${formatMetric(truck.odometer_km)} kilometres recorded on the odometer.`}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold text-foreground">{t("Vehicle condition")}</p>
            </div>
            {hasWearData ? (
              <span className="rounded-md border border-border/40 bg-background/40 px-2 py-1 text-[10px] text-muted-foreground">
                {t("Wear by system")}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">{t("No data")}</span>
            )}
          </div>
          {hasWearData ? (
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              {wearItems
                .filter((item) => item.value != null)
                .map((item) => (
                  <ProgressLine
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    mode="wear"
                  />
                ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/25 p-3 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {t("Wear details are not available for this vehicle.")}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function TrucksGrid({ trucks }: { trucks: TruckInfo[] }) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const fuelValues = trucks
    .map((truck) => asPercent(truck.fuel_relative))
    .filter((value): value is number => value != null);
  const wearValues = trucks
    .flatMap((truck) => [
      truck.engine_wear,
      truck.transmission_wear,
      truck.cabin_wear,
      truck.chassis_wear,
    ])
    .map(asPercent)
    .filter((value): value is number => value != null);
  const averageFuel =
    fuelValues.length > 0
      ? fuelValues.reduce((sum, value) => sum + value, 0) / fuelValues.length
      : null;
  const averageWear =
    wearValues.length > 0
      ? wearValues.reduce((sum, value) => sum + value, 0) / wearValues.length
      : null;
  const lowWearTrucks = trucks.filter((truck) => {
    const values = [
      truck.engine_wear,
      truck.transmission_wear,
      truck.cabin_wear,
      truck.chassis_wear,
    ]
      .map(asPercent)
      .filter((value): value is number => value != null);
    return values.length > 0 && values.every((value) => value < 20);
  }).length;
  return (
    <section id="fleet-section" className="scroll-mt-4 space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t("Fleet & Vehicles")}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Condition, fuel, and odometer details for trucks in this save.")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-card/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${trucks.length > 0 ? "bg-emerald-400" : "bg-muted-foreground/50"}`}
          />
          {trucks.length} {t(trucks.length === 1 ? "vehicle" : "vehicles")}
        </span>
      </div>

      {trucks.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <FleetMetric
            label={t("Average fuel")}
            value={averageFuel}
            suffix="%"
            icon={<Fuel className="h-4 w-4" />}
            tone="cyan"
            emptyLabel={t("Fuel data unavailable")}
          />
          <FleetMetric
            label={t("Average wear")}
            value={averageWear}
            suffix="%"
            icon={<Wrench className="h-4 w-4" />}
            tone={
              averageWear != null && averageWear >= 45
                ? "red"
                : averageWear != null && averageWear < 20
                  ? "green"
                  : "amber"
            }
            emptyLabel={t("Wear data unavailable")}
          />
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.045] p-3.5">
            <div className="flex items-center justify-between gap-2 text-emerald-300">
              <span className="text-xs font-medium">{t("Fleet in good shape")}</span>
              <Truck className="h-4 w-4" />
            </div>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">
              {lowWearTrucks}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {trucks.length}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("Trucks with known wear below 20%")}
            </p>
          </div>
        </div>
      )}

      {trucks.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/55 bg-card/30 px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/45 bg-background/50 text-muted-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-foreground">
            {t("No trucks in this save")}
          </h4>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {t(
              "No owned vehicles were found in the selected save file. This view will populate when vehicle data is available.",
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 2xl:grid-cols-2">
          {trucks.map((truck) => (
            <TruckCard key={truck.index} truck={truck} />
          ))}
        </div>
      )}
    </section>
  );
}

function FleetMetric({
  label,
  value,
  suffix,
  icon,
  tone,
  emptyLabel,
}: {
  label: string;
  value: number | null;
  suffix: string;
  icon: ReactNode;
  tone: "cyan" | "amber" | "red" | "green";
  emptyLabel: string;
}) {
  const toneClass =
    tone === "cyan"
      ? "text-cyan-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "green"
          ? "text-emerald-300"
          : "text-amber-300";
  const width = value == null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="rounded-xl border border-border/40 bg-card/45 p-3.5">
      <div className={`flex items-center justify-between gap-2 ${toneClass}`}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">
        {value == null ? "—" : `${value.toFixed(0)}${suffix}`}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
        <div
          className={`h-full rounded-full ${tone === "cyan" ? "bg-cyan-400" : tone === "red" ? "bg-red-400" : tone === "green" ? "bg-emerald-400" : "bg-amber-400"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {value == null && <p className="mt-1 text-[11px] text-muted-foreground">{emptyLabel}</p>}
    </div>
  );
}
