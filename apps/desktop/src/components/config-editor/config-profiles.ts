const STORAGE_KEY = "roadbyte-config-profiles-v1";
const PRIVATE_KEY_PATTERN = /password|passwd|token|secret|api[_-]?key|path|directory/i;

export interface ConfigProfile {
  id: string;
  name: string;
  game: string;
  createdAt: string;
  values: Record<string, string>;
}

export function readConfigProfiles(storage: Pick<Storage, "getItem">): ConfigProfile[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ConfigProfile =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.game === "string" &&
        typeof item.createdAt === "string" &&
        typeof item.values === "object" &&
        item.values !== null &&
        !Array.isArray(item.values) &&
        Object.values(item.values).every((value) => typeof value === "string"),
    );
  } catch {
    return [];
  }
}

export function writeConfigProfiles(storage: Pick<Storage, "setItem">, profiles: ConfigProfile[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function makeConfigProfile(
  name: string,
  game: string,
  entries: Array<{ key: string; value: string }>,
  now = new Date(),
): ConfigProfile {
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    game,
    createdAt: now.toISOString(),
    values: Object.fromEntries(
      entries
        .filter(({ key }) => !PRIVATE_KEY_PATTERN.test(key))
        .map(({ key, value }) => [key, value]),
    ),
  };
}

export function previewConfigProfile(
  profile: ConfigProfile,
  entries: Array<{ key: string; value: string }>,
) {
  return entries.flatMap((entry) => {
    const value = profile.values[entry.key];
    if (value === undefined || value === entry.value) return [];
    const sensitive = PRIVATE_KEY_PATTERN.test(entry.key);
    return [
      {
        key: entry.key,
        before: sensitive ? "••••••" : entry.value,
        after: sensitive ? "••••••" : value,
      },
    ];
  });
}

export function applyConfigProfile<T extends { key: string; value: string }>(
  profile: ConfigProfile,
  entries: T[],
): T[] {
  return entries.map((entry) => {
    const value = profile.values[entry.key];
    return value === undefined ? entry : { ...entry, value };
  });
}
