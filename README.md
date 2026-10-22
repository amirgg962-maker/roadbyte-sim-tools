# Roadbyte Sim Tools

**Roadbyte edition by Amircore (@TGT_AM).**  
**Branding, visual redesign, and customization by Amircore (@TGT_AM).**

Roadbyte Sim Tools is a desktop toolkit for Euro Truck Simulator 2. It helps players inspect profiles and save files, edit money and experience points, manage selected save actions, and browse game configuration values through a dark interface with a charcoal-black base, soft neon-orange accents, and subtle abstract lighting.

> This is an early Roadbyte branding and customization build. The application still needs a successful compile and runtime test before a public installer should be distributed.

![Version](https://img.shields.io/badge/version-0.3.0--beta-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Product direction

The Roadbyte product name, visual identity, and feature roadmap are maintained as a distinct project. Future releases may expand into additional simulation utilities while keeping save editing and configuration management as core features.

## Current features

- **Save overview:** browse detected profiles and save files, and inspect available progress statistics.
- **Money and XP editor:** change supported save values directly.
- **Quick actions:** unlock cities, maximize skills, repair vehicles, and refuel where supported.
- **Save management:** rename, clone, and delete save files.
- **Configuration editor:** search and edit `config.cfg` values with type-aware validation and descriptions.
- **Automatic backups:** create timestamped backups before supported edits.
- **Read-only by default:** editing must be explicitly enabled to help prevent accidental changes.
- **Compatibility details:** display detected game information and supported-version warnings.

## Safety notes

Always keep a separate backup of valuable profiles before editing. Changes to save files may affect compatibility with multiplayer mods or other third-party tools. Roadbyte Sim Tools is intended for local save/configuration management and does not attempt to bypass anti-cheat systems or multiplayer restrictions.

## Build from source

The project uses React, TypeScript, Vite, Tauri 2, Rust, and a pnpm workspace.

1. Install the prerequisites described in the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) and install Node.js.
2. Install the repository's pinned pnpm version.
3. From the project root, run:

   ```sh
   pnpm install
   pnpm dev
   ```

4. To build the frontend and verify TypeScript, run:

   ```sh
   pnpm build
   ```

A packaged installer should only be published after building and testing it on the target platform. Release downloads will be added to the Roadbyte project page when ready.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions and testing guidance. Before redistribution, keep the license and copyright notices included in `LICENSE` intact.

