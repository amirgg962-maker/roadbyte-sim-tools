---
bump: minor
---

### Highlights

- Add a source-aware Config catalog that distinguishes current evidence, legacy references, app guidance, and unknown settings.
- Show verified sliders only when a range is confirmed for the selected game and version; preserve out-of-range values for exact editing.
- Add clearer recovery actions for missing or unreadable config files, including retry and game-folder settings.
- Localize the game-folder picker used by the recovery flow.

### Fixed

- Validate config string values and detect external file edits before saving, reducing the risk of malformed values or overwriting newer changes.
