export type ConfigGame = "ets2" | "ats" | "unknown";
export type ConfigEvidence =
  | "current-primary"
  | "observed-current-game"
  | "legacy-primary"
  | "community"
  | "app-guidance"
  | "unknown";

export interface ConfigMetadata {
  category?: string;
  description?: string;
  evidence: ConfigEvidence;
  games?: readonly Exclude<ConfigGame, "unknown">[];
  source?: string;
  sourceNote?: string;
  sourceCheckedAt?: string;
  validGameVersions?: readonly string[];
  valueType?: "Int" | "Float" | "Bool" | "String";
  defaultValue?: string;
  range?: ConfigRange;
  allowedValues?: readonly string[];
}

export interface ConfigRange {
  min: number;
  max: number;
  step: number;
}

export interface AppConfigGuidance {
  description?: string;
  range?: ConfigRange;
}

const SCS_CONFIG_VARIABLES_URL =
  "https://modding.scssoft.com/wiki/Documentation/Engine/Configuration_variables";
const RESEARCHED_AT = "2026-10-25";

// SCS marks this reference obsolete. Its bounds and descriptions are retained
// as historical context and must never enable a clamping control.
const LEGACY_SCS_METADATA: Record<string, ConfigMetadata> = {
  g_traffic: {
    category: "Gameplay",
    description: "Traffic intensity; the legacy reference documents 0 as disabled and 10 as maximum.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; the page is marked obsolete and may not match current game versions.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Float",
    defaultValue: "1.0",
    range: { min: 0, max: 10, step: 0.1 },
  },
  g_console: {
    category: "Developer",
    description: "Enables the in-game console.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; verify against the installed game version.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Int",
    defaultValue: "0",
  },
  g_developer: {
    category: "Developer",
    description: "Enables developer mode.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; verify against the installed game version.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Int",
    defaultValue: "0",
  },
  r_vsync: {
    category: "Graphics",
    description: "Enables or disables vertical synchronization.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; verify against the installed game version.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Int",
    defaultValue: "1",
  },
  r_gamma: {
    category: "Graphics",
    description: "Gamma correction factor; the legacy reference says this applies only in fullscreen mode.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; verify against the installed game version.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Float",
    defaultValue: "1.0",
  },
  r_color_cyan_red: {
    category: "Graphics",
    description: "Cyan-to-red color correction factor.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; its -1 to 1 bounds may not match current game versions.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Float",
    defaultValue: "0.0",
    range: { min: -1, max: 1, step: 0.01 },
  },
  r_color_magenta_green: {
    category: "Graphics",
    description: "Magenta-to-green color correction factor.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; its -1 to 1 bounds may not match current game versions.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Float",
    defaultValue: "0.0",
    range: { min: -1, max: 1, step: 0.01 },
  },
  r_color_yellow_blue: {
    category: "Graphics",
    description: "Yellow-to-blue color correction factor.",
    evidence: "legacy-primary",
    source: SCS_CONFIG_VARIABLES_URL,
    sourceNote: "Legacy SCS reference; its -1 to 1 bounds may not match current game versions.",
    sourceCheckedAt: RESEARCHED_AT,
    valueType: "Float",
    defaultValue: "0.0",
    range: { min: -1, max: 1, step: 0.01 },
  },
};

export const LEGACY_SCS_CONFIG_KEYS = Object.keys(LEGACY_SCS_METADATA);

function unknownMetadata(): ConfigMetadata {
  return { evidence: "unknown" };
}

export function inferConfigGame(path: string): ConfigGame {
  const segments = path
    .split("\\")
    .join("/")
    .split("/")
    .map((segment) => segment.trim().toLowerCase());

  if (segments.includes("euro truck simulator 2") || segments.includes("227300")) return "ets2";
  if (segments.includes("american truck simulator") || segments.includes("270880")) return "ats";
  return "unknown";
}

export function getConfigMetadata(
  key: string,
  game: ConfigGame,
  _gameVersion?: string,
  appGuidance?: AppConfigGuidance,
): ConfigMetadata {
  const legacy = LEGACY_SCS_METADATA[key];
  if (legacy && game !== "unknown") return legacy;

  const description = appGuidance?.description;
  const range = appGuidance?.range;
  if (description || range) {
    return {
      evidence: "app-guidance",
      ...(description ? { description } : {}),
      ...(range ? { range } : {}),
      sourceNote: "Roadbyte guidance; not verified as a current game limit.",
    };
  }
  return unknownMetadata();
}

export function getConfigDisplayCategory(
  key: string,
  game: ConfigGame,
  gameVersion?: string,
  appGuidance?: AppConfigGuidance,
): string {
  return getConfigMetadata(key, game, gameVersion, appGuidance).category ?? "Unverified";
}

export function isVerifiedRange(
  metadata: ConfigMetadata,
  game: ConfigGame,
  gameVersion?: string,
): boolean {
  return (
    (metadata.evidence === "current-primary" || metadata.evidence === "observed-current-game") &&
    Boolean(metadata.range) &&
    game !== "unknown" &&
    Boolean(metadata.games?.includes(game)) &&
    Boolean(gameVersion && metadata.validGameVersions?.includes(gameVersion))
  );
}

export interface NumericControlState {
  showSlider: boolean;
  value: string;
  range?: ConfigRange;
  outOfRange: boolean;
}

export function getNumericControlState(
  value: string,
  metadata: ConfigMetadata,
  game: ConfigGame,
  gameVersion?: string,
): NumericControlState {
  const number = Number(value);
  const hasNumericValue = value.trim().length > 0 && Number.isFinite(number);
  const range = metadata.range;
  const outOfRange = Boolean(
    range && hasNumericValue && (number < range.min || number > range.max),
  );
  const showSlider = Boolean(
    range &&
      hasNumericValue &&
      !outOfRange &&
      isVerifiedRange(metadata, game, gameVersion),
  );

  return {
    showSlider,
    value,
    ...(range ? { range } : {}),
    outOfRange,
  };
}
