# Roadbyte Sim Tools

**A desktop toolkit for managing Euro Truck Simulator 2 profiles, save files, and configuration.**

Roadbyte Sim Tools helps you inspect profiles, review save data, edit supported values, manage saves, and work with selected `config.cfg` settings. The interface uses a dark charcoal theme with restrained orange accents.

> Roadbyte Sim Tools is an independent community utility and is not affiliated with or endorsed by SCS Software.

[![Latest release](https://img.shields.io/github/v/release/amirgg962-maker/roadbyte-sim-tools?label=latest%20release)](https://github.com/amirgg962-maker/roadbyte-sim-tools/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Downloads:** [Open the latest release page](https://github.com/amirgg962-maker/roadbyte-sim-tools/releases/latest). Windows users should choose the `.msi` file; macOS and Linux users should choose the package matching their system.

For most Windows PCs, choose the file ending in **`.msi`** on the latest release page. The **`.exe`** installer is an alternative. Download the installer only; `.sig` files and `latest.json` are used to verify and deliver updates and are not installers.

فارسی: [راهنمای فارسی](README-FA.md)

## Features

- **Profile and save browser:** find profiles and saves and review available progress information.
- **Save editor:** change supported money and experience values and use supported quick actions.
- **Save management:** rename, clone, and delete save files.
- **Configuration editor:** search and edit `config.cfg` values with type-aware validation.
- **Automatic backups:** create timestamped backups before supported edits.
- **Safer editing:** the app opens in read-only mode; editing must be explicitly enabled.
- **Compatibility information:** review detected game details and supported-version warnings.

Feature availability can depend on the save format and game version. Keep a separate backup of valuable profiles before making changes.

## Install

1. Open [GitHub Releases](https://github.com/amirgg962-maker/roadbyte-sim-tools/releases/latest).
2. On Windows, download the **`.msi`** installer. Use the **`x64-setup.exe`** installer if MSI does not work for your setup.
3. Run the installer and follow its prompts.

macOS and Linux packages are also listed on the release page. Select the package that matches your operating system and processor. `.sig` files are signatures, not applications.

Releases include signed updater packages and a public `latest.json` feed. The app can check for updates from **Settings → Software updates**. The current public release artifacts and feed are published; if the in-app update reports an error or the displayed version does not change after restarting, install the latest version manually from the Releases page.

## Build from source

The desktop app uses React, TypeScript, Vite, Tauri 2, Rust, and pnpm. Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), Node.js, Rust, and the repository's pinned pnpm version (`pnpm@11.11.0`).

From the repository root:

```sh
pnpm install
pnpm tauri dev
```

To build the frontend and check TypeScript:

```sh
pnpm build
```

To build a desktop installer, install the platform-specific Tauri bundler prerequisites and run:

```sh
pnpm tauri build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture notes, checks, and contribution steps.

## Safety and compatibility

Save editing changes local game files and can affect compatibility with game updates, mods, or other tools. Keep independent backups before editing. Roadbyte Sim Tools is intended for local profile and configuration management; it does not bypass anti-cheat systems or multiplayer restrictions. Do not share real save files or unredacted logs in public bug reports.

## Support

- [Report a bug or request a feature](https://github.com/amirgg962-maker/roadbyte-sim-tools/issues/new/choose)
- [Browse releases](https://github.com/amirgg962-maker/roadbyte-sim-tools/releases)
- [Contributing guide](CONTRIBUTING.md)

## License

Roadbyte Sim Tools is distributed under the [MIT License](LICENSE).
