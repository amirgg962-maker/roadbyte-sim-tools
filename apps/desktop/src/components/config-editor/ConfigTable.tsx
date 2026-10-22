import { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Slider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "ui";
import { RotateCcw, Info, CircleAlert } from "lucide-react";
import type { ConfigEntry, ConfigValueType } from "../../types";
import { CONFIG_RANGES } from "../../config-ranges";
import type { ConfigRange } from "../../config-ranges";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

export function formatKeyName(key: string): string {
  const parts = key.split("_");
  const startIdx = parts[0]?.length === 1 || parts[0] === "ui" ? 1 : 0;
  const name = parts
    .slice(startIdx)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${name} (${key})`;
}

function humanizeKey(key: string): string {
  const parts = key.split("_");
  const startIdx = parts[0]?.length === 1 || parts[0] === "ui" ? 1 : 0;
  return (
    parts
      .slice(startIdx)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") || key
  );
}

interface ConfigTableProps {
  entries: { entry: ConfigEntry; index: number }[];
  configErrors: Record<number, string | null>;
  originalValues: string[];
  onValueChange: (index: number, value: string, type: ConfigValueType) => void;
  onRevert: (index: number) => void;
  descriptions: Record<string, string>;
  readOnly: boolean;
}

function NumericSlider({
  entry,
  entryIndex,
  step,
  range,
  onValueChange,
  readOnly,
  error,
}: {
  entry: ConfigEntry;
  entryIndex: number;
  step: number;
  range?: ConfigRange;
  onValueChange: (index: number, value: string, type: ConfigValueType) => void;
  readOnly: boolean;
  error: string | null;
}) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const parsed =
    entry.value_type === "Int" ? Number.parseInt(entry.value, 10) : Number.parseFloat(entry.value);
  const safeNum = Number.isFinite(parsed) ? parsed : 0;

  let min: number, max: number, effectiveStep: number;
  if (range) {
    min = range.min;
    max = range.max;
    effectiveStep = range.step;
  } else {
    min = safeNum >= 0 ? 0 : -10000;
    max = safeNum >= 0 ? 10000 : 0;
    effectiveStep = step;
  }
  const sliderValue = Math.min(max, Math.max(min, safeNum));
  const hasRange = Boolean(range);
  // Keep pointer/keyboard movement local while the thumb is moving. Committing
  // every tick updates the parent config document and re-renders every row in
  // the table, which makes the slider feel laggy on large config files.
  const [draftSliderValue, setDraftSliderValue] = useState(sliderValue);
  const [isSliderInteracting, setIsSliderInteracting] = useState(false);

  useEffect(() => {
    // Sync when a value is changed externally (typed directly, reverted, or
    // loaded from disk), but don't pull the thumb back during an active drag.
    if (!isSliderInteracting) setDraftSliderValue(sliderValue);
  }, [sliderValue, isSliderInteracting]);

  const formatSliderValue = (value: number) =>
    entry.value_type === "Int" ? String(Math.round(value)) : value.toFixed(2);

  return (
    <div className="min-w-[220px] space-y-2">
      <div className="flex items-center gap-3">
        <Slider
          value={[draftSliderValue]}
          onValueChange={([value]) => {
            const nextValue = value ?? draftSliderValue;
            setDraftSliderValue(nextValue);
            setIsSliderInteracting(true);
          }}
          onValueCommit={([value]) => {
            const nextValue = value ?? draftSliderValue;
            setDraftSliderValue(nextValue);
            setIsSliderInteracting(false);
            // Update the shared config only once, when the user releases the
            // thumb (or finishes a keyboard interaction), not on every tick.
            onValueChange(entryIndex, formatSliderValue(nextValue), entry.value_type);
          }}
          min={min}
          max={max}
          step={effectiveStep}
          disabled={readOnly}
          aria-label={`${humanizeKey(entry.key)} slider`}
          className="flex-1"
        />
        <Input
          type="number"
          inputMode="decimal"
          value={isSliderInteracting ? formatSliderValue(draftSliderValue) : entry.value}
          onChange={(event) => onValueChange(entryIndex, event.target.value, entry.value_type)}
          readOnly={readOnly}
          aria-label={`${humanizeKey(entry.key)} value`}
          aria-invalid={Boolean(error)}
          step={effectiveStep}
          min={hasRange ? range?.min : undefined}
          max={hasRange ? range?.max : undefined}
          className={`h-8 w-[100px] shrink-0 text-right font-mono text-xs tabular-nums ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        {range ? (
          <>
            <span>Min {range.min}</span>
            <span className="font-medium text-foreground/70">Step {range.step}</span>
            <span>Max {range.max}</span>
          </>
        ) : (
          <span>{t("Slider range is approximate; type an exact value if needed.")}</span>
        )}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function ValueCell({
  entry,
  entryIndex,
  error,
  onValueChange,
  readOnly,
}: {
  entry: ConfigEntry;
  entryIndex: number;
  error: string | null;
  onValueChange: (index: number, value: string, type: ConfigValueType) => void;
  readOnly: boolean;
}) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  switch (entry.value_type) {
    case "Int":
      return (
        <NumericSlider
          entry={entry}
          entryIndex={entryIndex}
          step={1}
          range={CONFIG_RANGES[entry.key]}
          onValueChange={onValueChange}
          readOnly={readOnly}
          error={error}
        />
      );
    case "Float":
      return (
        <NumericSlider
          entry={entry}
          entryIndex={entryIndex}
          step={0.1}
          range={CONFIG_RANGES[entry.key]}
          onValueChange={onValueChange}
          readOnly={readOnly}
          error={error}
        />
      );
    case "Bool": {
      const usesNumericBoolean = entry.value === "0" || entry.value === "1";
      const boolValue = entry.value === "true" || entry.value === "1" ? "true" : "false";
      return (
        <div className="min-w-[145px] space-y-1">
          <Select
            value={boolValue}
            onValueChange={(value) =>
              onValueChange(
                entryIndex,
                usesNumericBoolean ? (value === "true" ? "1" : "0") : value,
                entry.value_type,
              )
            }
            disabled={readOnly}
          >
            <SelectTrigger
              className="h-8 w-36 text-xs"
              aria-label={`${humanizeKey(entry.key)} value`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true" className="text-xs">
                {t("Enabled · true")}
              </SelectItem>
              <SelectItem value="false" className="text-xs">
                {t("Disabled · false")}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            {t("Saved as")} {usesNumericBoolean ? "0 / 1" : "true / false"}
          </p>
        </div>
      );
    }
    default:
      return (
        <div className="min-w-[180px] space-y-1">
          <div className="flex items-center gap-1.5">
            <Input
              type="text"
              placeholder={t("Enter value…")}
              value={entry.value}
              onChange={(event) => onValueChange(entryIndex, event.target.value, entry.value_type)}
              readOnly={readOnly}
              aria-label={`${humanizeKey(entry.key)} value`}
              aria-invalid={Boolean(error)}
              className={`h-8 font-mono text-xs ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {error && (
              <CircleAlert className="h-4 w-4 shrink-0 text-destructive" aria-label={error} />
            )}
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
      );
  }
}

export function ConfigTable({
  entries,
  configErrors,
  originalValues,
  onValueChange,
  onRevert,
  descriptions,
  readOnly,
}: ConfigTableProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  return (
    <TooltipProvider>
      <Table>
        <TableHeader className="sticky top-0 z-[1] bg-muted/95 backdrop-blur-sm">
          <TableRow className="border-border/80 hover:bg-transparent">
            <TableHead className="w-[27%] pl-4 text-[10px] font-semibold uppercase tracking-wider">
              {t("Setting")}
            </TableHead>
            <TableHead className="w-[43%] text-[10px] font-semibold uppercase tracking-wider">
              {t("Value")}
            </TableHead>
            <TableHead className="w-[16%] text-[10px] font-semibold uppercase tracking-wider">
              {t("Category")}
            </TableHead>
            <TableHead className="w-[14%] pr-4 text-right text-[10px] font-semibold uppercase tracking-wider">
              {t("Actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(({ entry, index }) => {
            const error = configErrors[index] ?? null;
            const original = originalValues[index];
            const isModified = original !== undefined && original !== entry.value;
            const description = descriptions[entry.key];

            return (
              <TableRow
                key={`${entry.key}-${index}`}
                className={`group transition-colors ${
                  error
                    ? "bg-destructive/[0.045] hover:bg-destructive/[0.07]"
                    : isModified
                      ? "bg-orange-500/[0.055] hover:bg-orange-500/[0.09]"
                      : "hover:bg-muted/35"
                }`}
              >
                <TableCell className="py-3 pl-4 align-top">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${error ? "bg-destructive" : isModified ? "bg-orange-400" : "bg-border"}`}
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium leading-5 text-foreground">
                        {humanizeKey(entry.key)}
                      </p>
                      <p
                        className="break-all font-mono text-[10px] leading-4 text-muted-foreground"
                        title={entry.key}
                      >
                        {entry.key}
                      </p>
                      <span className="inline-flex rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        {entry.value_type}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3 align-top">
                  <ValueCell
                    entry={entry}
                    entryIndex={index}
                    error={error}
                    onValueChange={onValueChange}
                    readOnly={readOnly}
                  />
                </TableCell>
                <TableCell className="py-3 align-top">
                  <span className="inline-flex max-w-full rounded-md border border-border/70 bg-background/50 px-2 py-1 text-[10px] leading-4 text-muted-foreground">
                    {entry.category || t("Other")}
                  </span>
                </TableCell>
                <TableCell className="py-3 pr-4 align-top">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={readOnly || !isModified}
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-orange-500/10 hover:text-orange-300 disabled:opacity-30"
                          onClick={() => onRevert(index)}
                          aria-label={`${t("Revert")} ${entry.key}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isModified
                          ? `${t("Revert to original value")}: ${original}`
                          : t("No changes to revert")}
                      </TooltipContent>
                    </Tooltip>
                    {description && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`${t("About")} ${entry.key}`}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="max-w-80 space-y-2 text-xs" align="end">
                          <p className="font-mono text-[11px] font-semibold text-foreground">
                            {entry.key}
                          </p>
                          <p className="leading-5 text-muted-foreground">{description}</p>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
