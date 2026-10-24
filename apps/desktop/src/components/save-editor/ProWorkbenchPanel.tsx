import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge, Button, Input, toast } from "ui";
import { ArrowRightLeft, Check, Gauge, Layers3, Wrench } from "lucide-react";
import type { ProfileInfo, SaveData, SaveInfo, EditResult } from "../../types";
import { compareSaveSnapshots, diffMods, filterFleet } from "../../utils/roadbyte-workbench.js";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

type FleetFilter = "all" | "attention" | "low-fuel" | "high-wear";
type ComposerAction = "money-xp" | "repair" | "refuel" | "unlock" | "skills";

const actions: Array<{ id: ComposerAction; label: string; note: string; command?: string }> = [
  { id: "money-xp", label: "Money & XP", note: "Set the values entered in the editor" },
  {
    id: "repair",
    label: "Repair fleet",
    note: "Set supported wear values to 0%",
    command: "repair_all",
  },
  {
    id: "refuel",
    label: "Refuel fleet",
    note: "Set owned truck fuel to 100%",
    command: "refuel_all",
  },
  {
    id: "unlock",
    label: "Unlock cities",
    note: "Mark supported cities as visited",
    command: "unlock_cities",
  },
  {
    id: "skills",
    label: "Max skills",
    note: "Apply supported skill values",
    command: "max_skills",
  },
];

export function ProWorkbenchPanel({
  profiles,
  selectedSave,
  saveData,
  readOnly,
  moneyInput,
  xpInput,
  onReload,
}: {
  profiles: ProfileInfo[];
  selectedSave: SaveInfo | null;
  saveData: SaveData | null;
  readOnly: boolean;
  moneyInput: string;
  xpInput: string;
  onReload: () => void;
}) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>("all");
  const [selectedActions, setSelectedActions] = useState<ComposerAction[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [leftProfile, setLeftProfile] = useState("");
  const [rightProfile, setRightProfile] = useState("");

  const filteredTrucks = useMemo(
    () => filterFleet(saveData?.trucks ?? [], fleetFilter),
    [saveData?.trucks, fleetFilter],
  );
  const left = profiles.find((profile) => profile.path === leftProfile);
  const right = profiles.find((profile) => profile.path === rightProfile);
  const comparison = compareSaveSnapshots(
    left ? { xp: left.cached_experience, total_distance_km: left.cached_distance } : null,
    right ? { xp: right.cached_experience, total_distance_km: right.cached_distance } : null,
  );
  const modDelta = left && right ? diffMods(left.active_mods, right.active_mods) : null;

  async function applyPlan() {
    if (!selectedSave || readOnly || running || selectedActions.length === 0) return;
    setRunning(true);
    try {
      for (const actionId of selectedActions) {
        if (actionId === "money-xp") {
          const money = moneyInput.trim() ? Number(moneyInput) : null;
          const xp = xpInput.trim() ? Number(xpInput) : null;
          if (money == null && xp == null)
            throw new Error("Enter Money or XP values in the editor first.");
          if (
            (money != null && !Number.isSafeInteger(money)) ||
            (xp != null && !Number.isSafeInteger(xp))
          ) {
            throw new Error("Money and XP must be whole numbers within the safe integer range.");
          }
          await invoke<EditResult>("edit_save", {
            gameSiiPath: selectedSave.game_sii_path,
            money,
            xp,
          });
        } else {
          const action = actions.find((item) => item.id === actionId);
          if (action?.command)
            await invoke<EditResult>(action.command, { gameSiiPath: selectedSave.game_sii_path });
        }
      }
      toast.success("Action plan completed. Each changed operation created its own backup.");
      setReviewOpen(false);
      setSelectedActions([]);
      onReload();
    } catch (error) {
      toast.error(
        `Action plan stopped: ${String(error)}. Earlier completed steps may already be saved and backed up.`,
      );
      setReviewOpen(false);
      onReload();
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-primary/20 bg-card/45 p-4 md:p-5">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            {t("Roadbyte Pro")}
          </p>
          <h2 className="text-base font-semibold">{t("Pro Workbench")}</h2>
        </div>
        <Badge variant="outline" className="ml-auto">
          {t("Preview · Backup protected")}
        </Badge>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t("Fleet Workshop")}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "attention", "low-fuel", "high-wear"] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={fleetFilter === filter ? "default" : "outline"}
                onClick={() => setFleetFilter(filter)}
              >
                {t(filter.replace("-", " "))}
              </Button>
            ))}
          </div>
          {saveData ? (
            <div className="max-h-52 space-y-2 overflow-auto">
              {filteredTrucks.length ? (
                filteredTrucks.map((truck) => (
                  <div
                    key={truck.index}
                    className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs"
                  >
                    <span>
                      {t("Truck")} {truck.index + 1} ·{" "}
                      {truck.license_plate || t("License plate unavailable")}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      Fuel{" "}
                      {truck.fuel_relative == null
                        ? "—"
                        : `${Math.round(truck.fuel_relative * 100)}%`}{" "}
                      · wear{" "}
                      {Math.round(
                        Math.max(
                          truck.engine_wear ?? 0,
                          truck.transmission_wear ?? 0,
                          truck.cabin_wear ?? 0,
                          truck.chassis_wear ?? 0,
                        ) * 100,
                      )}
                      %
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">{t("No trucks match this filter.")}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("Select a save to inspect its fleet.")}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t(
              "For safe edits, use the existing Repair All and Refuel All actions in the save editor; individual truck writes are not currently supported by the save parser.",
            )}
          </p>
        </article>

        <article className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t("Profile Compare")}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label={t("Choose profile A")}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              value={leftProfile}
              onChange={(event) => setLeftProfile(event.target.value)}
            >
              <option value="">{t("Choose profile A")}</option>
              {profiles.map((profile) => (
                <option
                  key={profile.path}
                  value={profile.path}
                  disabled={profile.path === rightProfile}
                >
                  {profile.display_name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("Choose profile B")}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              value={rightProfile}
              onChange={(event) => setRightProfile(event.target.value)}
            >
              <option value="">{t("Choose profile B")}</option>
              {profiles.map((profile) => (
                <option
                  key={profile.path}
                  value={profile.path}
                  disabled={profile.path === leftProfile}
                >
                  {profile.display_name}
                </option>
              ))}
            </select>
          </div>
          {left && right ? (
            <div className="space-y-2">
              {comparison.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 rounded-lg bg-muted/30 px-3 py-2 text-xs"
                >
                  <span>{t(item.key === "xp" ? "Experience" : "Distance (km)")}</span>
                  <span>{item.left ?? "—"}</span>
                  <span>→</span>
                  <span className="font-semibold">
                    {item.right ?? "—"}
                    {item.delta != null ? ` (${item.delta > 0 ? "+" : ""}${item.delta})` : ""}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "Profile cache values may be unavailable until the game refreshes its profile data.",
                )}
              </p>
              <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                <p className="text-xs font-semibold">{t("Mod Impact Map")}</p>
                {modDelta && modDelta.added.length === 0 && modDelta.removed.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("The profile mod lists match.")}
                  </p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400">
                        {t("Only in profile B")}
                      </p>
                      {modDelta?.added.map((mod) => (
                        <p key={mod} className="mt-1 truncate text-[11px]" title={mod}>
                          + {mod}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-amber-400">
                        {t("Only in profile A")}
                      </p>
                      {modDelta?.removed.map((mod) => (
                        <p key={mod} className="mt-1 truncate text-[11px]" title={mod}>
                          − {mod}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {t(
                    "This compares listed mods only and cannot determine whether a mod caused a save issue.",
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("Choose two profiles to compare cached XP and distance.")}
            </p>
          )}
        </article>
      </div>

      <article className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("Action Composer")}</h3>
          <span className="text-xs text-muted-foreground">
            {t("Build a reviewed plan for")} {selectedSave?.save_name ?? "a selected save"}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {actions.map((action) => (
            <label
              key={action.id}
              className="flex cursor-pointer gap-2 rounded-lg border border-border/50 p-3 text-xs"
            >
              <input
                type="checkbox"
                disabled={!selectedSave || readOnly}
                checked={selectedActions.includes(action.id)}
                onChange={(event) =>
                  setSelectedActions((current) =>
                    event.target.checked
                      ? [...current, action.id]
                      : current.filter((value) => value !== action.id),
                  )
                }
              />
              <span>
                <b className="block">{t(action.label)}</b>
                <span className="text-muted-foreground">{t(action.note)}</span>
              </span>
            </label>
          ))}
        </div>
        {selectedActions.includes("money-xp") && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              aria-label="Money value for plan"
              value={moneyInput}
              readOnly
              placeholder="Set Money in the editor above"
            />
            <Input
              aria-label="XP value for plan"
              value={xpInput}
              readOnly
              placeholder="Set XP in the editor above"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            {t("Each operation creates a backup before writing.")}{" "}
            {t("If a step fails, earlier completed steps remain saved and backed up.")}
          </p>
          <Button
            disabled={!selectedSave || readOnly || selectedActions.length === 0 || running}
            onClick={() => setReviewOpen(true)}
          >
            {t("Review plan")} ({selectedActions.length})
          </Button>
        </div>
      </article>

      {reviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-background p-5 shadow-2xl">
            <div>
              <h3 className="text-lg font-semibold">{t("Review action plan")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Target")}: {selectedSave?.save_name}.{" "}
                {t("Each operation creates a backup before writing.")}
              </p>
            </div>
            <ul className="space-y-2">
              {selectedActions.map((id) => {
                const action = actions.find((item) => item.id === id)!;
                return (
                  <li key={id} className="flex gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {t(action.label)} — {t(action.note)}
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={running}>
                {t("Back")}
              </Button>
              <Button onClick={() => void applyPlan()} disabled={running || readOnly}>
                {t(running ? "Applying…" : "Apply plan")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
