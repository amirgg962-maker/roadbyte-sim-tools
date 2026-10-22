export interface EditPreviewRow {
  key: "money" | "xp";
  before: string;
  after: string;
}

function parseOptionalInteger(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function buildEditPreview(
  current: { money: string | null; xp: string | null },
  next: { money: string; xp: string },
): EditPreviewRow[] {
  const rows: EditPreviewRow[] = [];
  for (const key of ["money", "xp"] as const) {
    const after = parseOptionalInteger(next[key]);
    if (after === null) continue;
    const before = parseOptionalInteger(current[key]);
    if (after === before) continue;
    rows.push({
      key,
      before: before === null ? "—" : before.toLocaleString(),
      after: after.toLocaleString(),
    });
  }
  return rows;
}
