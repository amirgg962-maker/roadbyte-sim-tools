# Changelog

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
