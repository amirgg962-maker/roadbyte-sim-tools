import { Input, Kbd, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "ui";
import { ListFilter, Search, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";

interface ConfigToolbarProps {
  configFilter: string;
  onFilterChange: (value: string) => void;
  configCategory: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  matchCount: number;
  totalCount: number;
}

export function ConfigToolbar({
  configFilter,
  onFilterChange,
  configCategory,
  onCategoryChange,
  categories,
  matchCount,
  totalCount,
}: ConfigToolbarProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const hasFilters = Boolean(configFilter || configCategory);

  const categoryValue = configCategory || "__all_categories__";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
      <div className="relative min-w-[220px] flex-1 sm:flex-none">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="config-search"
          type="text"
          placeholder={t("Search keys, values, categories…")}
          value={configFilter}
          onChange={(event) => onFilterChange(event.target.value)}
          className="h-9 w-full pl-9 pr-14 sm:w-[290px]"
          aria-keyshortcuts="Control+F"
          aria-label={t("Search configuration settings")}
        />
        {configFilter ? (
          <button
            type="button"
            onClick={() => onFilterChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("Clear search")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            <Kbd className="text-[10px]">Ctrl+F</Kbd>
          </div>
        )}
      </div>

      <Select
        value={categoryValue}
        onValueChange={(value) => onCategoryChange(value === "__all_categories__" ? "" : value)}
      >
        <SelectTrigger className="h-9 w-[175px] gap-2 text-xs">
          <ListFilter className="h-3.5 w-3.5 shrink-0 text-orange-400" />
          <SelectValue placeholder={t("All categories")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all_categories__">{t("All categories")}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {t(category)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="inline-flex h-8 items-center rounded-lg border border-border/70 bg-muted/30 px-2.5 text-[11px] tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">{matchCount}</span>
        <span className="mx-1">/</span>
        {totalCount}
      </span>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            onFilterChange("");
            onCategoryChange("");
          }}
          className="text-xs font-medium text-orange-400 transition-colors hover:text-orange-300"
        >
          {t("Reset filters")}
        </button>
      )}
    </div>
  );
}
