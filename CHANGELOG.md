# Changelog

## roadbyte-sim-tools@0.1.3 (2026-10-23)

### Highlights

- Refreshed the Roadbyte Sim Tools identity with the new logo across the app and Windows installer.
- Updated the About panel to present Roadbyte as an independent project maintained by Amir.
- Load the save editor, config editor, and backup center only when opened, reducing initial bundle loading.

### Fixed

- Split frontend dependencies into a separate vendor chunk; the largest JavaScript chunk is now below Vite's warning threshold.
- Configure Windows static VC runtime through Tauri's current config and update Tauri CLI to avoid the deprecated environment-variable warning.

### Verification

- TypeScript and production frontend build passed without chunk-size warnings.
- Windows MSI and signed updater artifact built successfully without the STATIC_VCRUNTIME warning.
## roadbyte-sim-tools@0.1.2 (2026-10-23)

### Fixed

- Preserve CRLF line endings when inserting array values into SII save documents, preventing mixed line endings after edits.
- Accept either LF or CRLF in SII fixture and golden-file validation.

### Verification

- The focused CRLF regression test and full Rust test suite passed on the release commit before this version bump.
- GitHub Actions CI passed for the SII line-ending fix.
- The signed installer and production updater feed for this release still need release-workflow validation.

## roadbyte-sim-tools@0.1.1 (2026-10-23)

### Highlights

- Published signed installers for Windows, macOS, and Linux.
- Added the Roadbyte Sim Tools product identity, application branding, and creator credit.
- Updated public documentation and project metadata for the Roadbyte release.
- Included signed updater artifacts with the release.

### Verification

- The v0.1.1 CI workflow passed TypeScript checks, Rust formatting, Clippy, and Rust tests.
- The release workflow successfully built the Windows, macOS, and Linux bundles.
- The in-app update flow has not yet been verified end to end against the public release feed; use the Releases page to install updates until that verification is complete.
