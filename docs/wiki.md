# Roadbyte Sim Tools — Project Notes

## Purpose

Roadbyte Sim Tools is a desktop utility built with Tauri 2 for Euro Truck Simulator 2 players. Its current focus is save-file inspection/editing and game-configuration management, with room to add more simulation utilities over time.

## Design principles

- A modern charcoal-black interface with restrained neon-orange accents and abstract ambient lighting.
- Safe editing: read-only by default, validation before saving, and timestamped backups before supported modifications.
- Fast, native desktop behavior through Tauri and Rust.
- Clear separation between user-facing Roadbyte branding and implementation details.
- Offline-first use wherever the feature does not require external services.

## Current scope

- Detect game profiles and save files.
- Inspect player progress, money, XP, trucks, and available save metadata.
- Edit supported save values and run supported quick actions.
- Search and edit configuration values with validation.
- Rename, clone, and delete supported save files with backup safeguards.

## Possible future features

- More advanced truck and trailer inspection.
- Additional configuration presets and editable controls.
- Save analysis and career-progress summaries.
- Expanded support for other simulation games, subject to compatibility testing.

## Safety boundaries

- Back up files before modifying them.
- Do not write invalid values to game files.
- Do not bypass anti-cheat systems or multiplayer restrictions.
- State compatibility limitations clearly and test against supported game versions.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, and UI components.
- Desktop runtime and backend: Tauri 2 and Rust.
- Workspace/build: pnpm and Cargo.

## Release status

The latest public version of Roadbyte Sim Tools is available from [GitHub Releases](https://github.com/amirgg962-maker/roadbyte-sim-tools/releases/latest). Releases include Windows x64, Linux x86_64, macOS Intel, and macOS Apple Silicon packages, plus signed updater artifacts and `latest.json`.

For Windows, download the `.msi` installer; the `x64-setup.exe` is an alternative. The app provides an update check under Settings → Software updates. If an update fails or the version shown after restart is incorrect, install the latest release manually and report the issue with the app version and operating system.
