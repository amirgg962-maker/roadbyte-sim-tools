export type ActivityKind =
  | "values-edited"
  | "cities-unlocked"
  | "skills-maxed"
  | "trucks-repaired"
  | "trucks-refueled"
  | "save-renamed"
  | "save-copied"
  | "save-deleted"
  | "backup-restored"
  | "backup-deleted";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  timestamp: number;
  saveName: string;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const STORAGE_KEY = "roadbyte-activity-log-v1";
const MAX_ENTRIES = 100;
const ACTIVITY_EVENT = "roadbyte:activity-log-updated";

function getStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readActivityLog(storage: StorageLike | null = getStorage()): ActivityEntry[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActivityEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function isActivityEntry(value: unknown): value is ActivityEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ActivityEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.kind === "string" &&
    ACTIVITY_KINDS.has(entry.kind) &&
    typeof entry.timestamp === "number" &&
    Number.isFinite(entry.timestamp) &&
    Math.abs(entry.timestamp) <= 8.64e15 &&
    typeof entry.saveName === "string"
  );
}

const ACTIVITY_KINDS = new Set<ActivityKind>([
  "values-edited",
  "cities-unlocked",
  "skills-maxed",
  "trucks-repaired",
  "trucks-refueled",
  "save-renamed",
  "save-copied",
  "save-deleted",
  "backup-restored",
  "backup-deleted",
]);

export function recordActivity(
  kind: ActivityKind,
  saveName: string,
  options: { storage?: StorageLike | null; now?: number; id?: string } = {},
): ActivityEntry | null {
  const storage = options.storage === undefined ? getStorage() : options.storage;
  if (!storage) return null;
  const entry: ActivityEntry = {
    id: options.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    timestamp: options.now ?? Date.now(),
    saveName,
  };
  try {
    const entries = [entry, ...readActivityLog(storage)].slice(0, MAX_ENTRIES);
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(ACTIVITY_EVENT));
    return entry;
  } catch {
    return null;
  }
}

export function subscribeToActivityLog(onUpdate: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(ACTIVITY_EVENT, onUpdate);
  return () => window.removeEventListener(ACTIVITY_EVENT, onUpdate);
}
