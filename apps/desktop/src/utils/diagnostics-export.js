export function buildRedactedDiagnostics({
  appVersion,
  platform,
  language,
  gameVersion,
  testedGameVersion,
  customDirectoryConfigured,
  readOnly,
  now = new Date(),
}) {
  return {
    report_schema: 1,
    created_at_utc: now.toISOString(),
    application: { name: "Roadbyte Sim Tools", version: appVersion ?? "unknown" },
    environment: { platform: platform || "unknown", language },
    game: {
      detected_version: gameVersion ?? null,
      tested_version: testedGameVersion ?? null,
      custom_directory_configured: Boolean(customDirectoryConfigured),
    },
    safety: { read_only: Boolean(readOnly) },
    privacy:
      "This report omits filesystem paths, profile names, save/config contents, and account identifiers.",
  };
}
