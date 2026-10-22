import type { ConfigEntry } from "../../types";

export interface ConfigDiffItem {
  key: string;
  before: string;
  after: string;
}

export function getConfigDiff(entries: ConfigEntry[], originals: string[]): ConfigDiffItem[] {
  return entries.flatMap((entry, index) => {
    const before = originals[index];
    if (before === undefined || before === entry.value) return [];
    const isSensitive = /password|passwd|token|secret|api[_-]?key/i.test(entry.key);
    return [
      {
        key: entry.key,
        before: isSensitive ? "••••••" : before,
        after: isSensitive ? "••••••" : entry.value,
      },
    ];
  });
}
