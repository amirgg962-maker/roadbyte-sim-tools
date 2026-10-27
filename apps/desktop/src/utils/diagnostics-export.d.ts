export function buildRedactedDiagnostics(input: {
  appVersion?: string | null;
  platform?: string;
  language: string;
  gameVersion?: string | null;
  testedGameVersion?: string | null;
  customDirectoryConfigured: boolean;
  readOnly: boolean;
  now?: Date;
}): {
  report_schema: number;
  created_at_utc: string;
  application: { name: string; version: string };
  environment: { platform: string; language: string };
  game: {
    detected_version: string | null;
    tested_version: string | null;
    custom_directory_configured: boolean;
  };
  safety: { read_only: boolean };
  privacy: string;
};
