# Changelog

## roadbyte-sim-tools@0.1.3 (2026-10-23)

### Highlights

- Refreshed the Roadbyte Sim Tools identity and applied the new logo to the app and Windows installer.
- Updated the About panel to identify Roadbyte as an independent project maintained by Amir.
- Load the save editor, configuration editor, and Backup Center only when opened.

### Fixed

- Split frontend dependencies into a vendor chunk so the largest JavaScript chunk is below Vite's warning threshold.
- Configure the Windows static VC runtime through Tauri's supported configuration and update the Tauri CLI to remove the deprecated build-setting warning.

### Verification

- The public v0.1.3 release workflow completed successfully for Windows x64, Linux x86_64, macOS Intel, and macOS Apple Silicon.
- The release includes Windows MSI and NSIS installers, `latest.json`, and signed updater artifacts.
- The public release feed reports version 0.1.3 and includes signed Windows update entries.

## roadbyte-sim-tools@0.1.2 (2026-10-23)

### Fixed

- Preserve CRLF line endings when inserting array values into SII save documents, preventing mixed line endings after edits.
- Accept either LF or CRLF in SII fixture and golden-file validation.

### Verification

- The focused CRLF regression test and full Rust test suite passed on the release commit before this version bump.
- GitHub Actions CI passed for the SII line-ending fix.
- At the time this version was prepared, its signed installer and production updater feed still needed release-workflow validation; the v0.1.3 release workflow later completed successfully.

## roadbyte-sim-tools@0.1.1 (2026-10-23)

### Highlights

- Published signed installers for Windows, macOS, and Linux.
- Added the Roadbyte Sim Tools product identity, application branding, and creator credit.
- Updated public documentation and project metadata for the Roadbyte release.
- Included signed updater artifacts with the release.

### Verification

- The v0.1.1 CI workflow passed TypeScript checks, Rust formatting, Clippy, and Rust tests.
- The release workflow successfully built the Windows, macOS, and Linux bundles.
- At the time v0.1.1 was published, the in-app update flow had not yet been verified end to end. Later releases publish signed update artifacts; see the current README for the current manual fallback.
