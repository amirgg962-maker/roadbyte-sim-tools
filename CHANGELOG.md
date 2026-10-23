# Changelog

## roadbyte-sim-tools@0.1.1 (2026-10-23)

### Roadbyte identity and branding

- Established the Roadbyte Sim Tools product name and desktop application identity.
- Applied the charcoal-black and soft neon-orange branding direction.
- Updated the About panel with creator credit: Amircore (@TGT_AM).
- Removed previous-product links and stale demo screenshots from the public-facing documentation.
- Updated workspace, Rust crate, and build metadata to use Roadbyte naming where appropriate.

### Validation status

- Local TypeScript checks, Rust formatting, Clippy, and all Rust tests pass.
- Windows MSI and NSIS installers build locally, with updater signatures matching the configured public key.
- Rotated the updater signing key after the first GitHub Actions run exposed a key mismatch.
- The local signed updater trial downloaded and installed a newer package. The production GitHub Release feed still needs verification after publication.
