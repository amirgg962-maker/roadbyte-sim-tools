import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Check, Trash2 } from "lucide-react";
import { Button, Input, toast } from "ui";
import type { ConfigDocument } from "../../types";
import { translate } from "../../i18n";
import { useSettingsStore } from "../../stores/settings";
import {
  applyConfigProfile,
  makeConfigProfile,
  previewConfigProfile,
  readConfigProfiles,
  writeConfigProfiles,
  type ConfigProfile,
} from "./config-profiles";

interface ConfigProfilesPanelProps {
  configDoc: ConfigDocument;
  game: string;
  readOnly: boolean;
  onApply: (document: ConfigDocument) => void;
}

export function ConfigProfilesPanel({
  configDoc,
  game,
  readOnly,
  onApply,
}: ConfigProfilesPanelProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const [profiles, setProfiles] = useState<ConfigProfile[]>([]);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    setProfiles(readConfigProfiles(window.localStorage));
  }, []);

  const availableProfiles = useMemo(
    () => profiles.filter((profile) => profile.game === game),
    [profiles, game],
  );
  const selected =
    availableProfiles.find((profile) => profile.id === selectedId) ?? availableProfiles[0];
  const preview = selected ? previewConfigProfile(selected, configDoc.entries) : [];
  const currentKeys = new Set(configDoc.entries.map((entry) => entry.key));
  const unavailableCount = selected
    ? Object.keys(selected.values).filter((key) => !currentKeys.has(key)).length
    : 0;

  function persist(next: ConfigProfile[]) {
    try {
      writeConfigProfiles(window.localStorage, next);
      setProfiles(next);
    } catch {
      toast.error(t("Could not save this local config profile."));
    }
  }

  function saveCurrent() {
    const cleanedName = name.trim();
    if (!cleanedName) return;
    const profile = makeConfigProfile(cleanedName, game, configDoc.entries);
    const next = [
      profile,
      ...profiles.filter(
        (item) => item.name.toLowerCase() !== cleanedName.toLowerCase() || item.game !== game,
      ),
    ];
    persist(next);
    setSelectedId(profile.id);
    setName("");
  }

  function removeSelected() {
    if (!selected) return;
    const next = profiles.filter((profile) => profile.id !== selected.id);
    persist(next);
    setSelectedId("");
  }

  return (
    <details className="rounded-xl border border-border/60 bg-card/30 p-3">
      <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
        {t("Config profiles")}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {t("Save and preview local setting presets")}
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">
          {t(
            "Profiles stay on this device. Sensitive values and file paths are excluded. Applying one changes only the editor draft; review and save it through the normal backup-protected flow.",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={t("Preset name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("Preset name")}
            maxLength={60}
            className="h-9 min-w-40 flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!name.trim()}
            onClick={saveCurrent}
          >
            <BookmarkPlus className="mr-1.5 h-4 w-4" /> {t("Save current as preset")}
          </Button>
        </div>
        {profiles.length > 0 && availableProfiles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {t("Saved presets are for a different game config and are hidden here.")}
          </p>
        )}
        {availableProfiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t("Choose a config preset")}
              className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              value={selected?.id ?? ""}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {availableProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selected || preview.length === 0 || readOnly}
              onClick={() =>
                selected && onApply({ entries: applyConfigProfile(selected, configDoc.entries) })
              }
            >
              <Check className="mr-1.5 h-4 w-4" /> {t("Apply to editor draft")}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("Delete preset")}
              disabled={!selected}
              onClick={removeSelected}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {selected && (
          <div className="rounded-lg border border-border/50 bg-background/45 p-3">
            <p className="text-xs font-medium">
              {t("Preview")}: {preview.length} {t("settings would change")}
            </p>
            {unavailableCount > 0 && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                {unavailableCount}{" "}
                {t("preset settings are absent from this config and will be skipped.")}
              </p>
            )}
            {preview.length > 0 ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {preview.map((change) => (
                  <li
                    key={change.key}
                    className="grid grid-cols-[minmax(6rem,1fr)_auto_minmax(6rem,1fr)] gap-2 font-mono"
                  >
                    <span className="truncate">{change.key}</span>
                    <span className="truncate text-muted-foreground">{change.before} →</span>
                    <span className="truncate text-primary">{change.after}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("This preset already matches the current config.")}
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
