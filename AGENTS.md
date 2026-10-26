# Roadbyte Sim Tools · AGENTS.md

Tauri v2 monorepo (pnpm workspace). Rust backend (`apps/desktop/src-tauri`) + React/TypeScript frontend (`apps/desktop/src`). Shared UI library at `packages/ui` (shadcn/ui-based). `packages/config` is a tsconfig-only package.

## Commands

```sh
pnpm dev              # Vite dev server (port 5173)
pnpm build            # tsc --noEmit && vite build
pnpm check-types      # tsc --noEmit (TS frontend only)
pnpm check            # oxlint && oxfmt --write (JS/TS lint + format)
pnpm lint             # vp lint (oxlint via vite-plus)
pnpm format           # vp fmt (oxfmt via vite-plus)
pnpm cargo:check      # cargo check --workspace
pnpm cargo:fmt        # cargo fmt --all --check
pnpm cargo:clippy     # cargo clippy --workspace --all-targets -- -D warnings
pnpm cargo:build      # cargo build --workspace
pnpm tauri            # pnpm --filter @roadbyte-sim-tools/desktop tauri <subcommand>
pnpm prepush          # types + lint + frontend tests + Clippy + fmt + Rust tests
pnpm test             # cargo test --workspace --all-features --locked
```

Use `pnpm --filter @roadbyte-sim-tools/desktop` for per-package scripts. Package manager is `pnpm@11.11.0`.

## Architecture

- **Frontend**: React 19 + TypeScript 7 + Zustand (no react-router; tab routing via zustand store)
- **Backend**: Rust Tauri commands in `commands/` → `core/` (game detection, profiles, backups) → `save_parser/` (SII parsing, ScsC crypto)
- **Styling**: Tailwind CSS v4 (no `tailwind.config.js`; uses `@tailwindcss/vite` plugin) + shadcn/ui from `packages/ui`
- **State**: Zustand stores in `apps/desktop/src/stores/` with Tauri plugin-store persistence (falls back to localStorage)
- **Fonts**: Inter Variable and Source Code Pro Variable come from the shared UI package; Vazirmatn Variable is bundled locally and used for Persian.

## Rust constraints

Clippy is very strict: `unwrap_used`, `expect_used`, `todo`, `dbg_macro`, `print_stdout`, `print_stderr` are **warn-level** (escalated to error via `-D warnings` in clippy). Use `anyhow::Context` / `Result` combinators instead of panicking. `#[allow(...)]` is acceptable in tests (already configured in `.clippy.toml`).

## JS/TS linting

oxlint (no eslint). Key rules:

- `no-console`: warn
- `no-non-null-assertion`: warn
- `consistent-type-imports`: prefer inline `type` imports
- `no-unused-vars`: warn (ignore `^_` prefix)
- React: `jsx-curly-brace-presence: never`, `jsx-boolean-value: never`, `jsx-fragments: syntax`
- `packages/ui/**` is **excluded** from lint

oxfmt for formatting: double quotes, semicolons on.

## SCS save files

- `ScsC` header → AES-256-CBC + zlib + HMAC-SHA256 (hardcoded key in `compression.rs`)
- `SiiN` header → plaintext SII (no crypto)
- `BSII` header → **unsupported** (agent must never suggest BSII support; game must use `g_save_format 2`)
- `SiiDocument` regex-based parser in `save_parser/sii.rs`; `SaveEditor` in `save_parser/editor.rs`

## Testing

- Frontend tests use Node's built-in `node:test` runner: `pnpm test:frontend`.
- Rust tests use Cargo. Run focused tests with `cargo test -p roadbyte-sim-tools -- <test_name>`.
- Golden tests (`golden_test.rs`) write actual output to `*.actual` next to golden files if they differ. Missing golden files are **auto-bootstrapped** on first run.
- Test fixtures in `tests/fixtures/`. Editor integration uses `tests/fixtures/editor/input.sii` + `tests/fixtures/editor/golden/`.

## CI & hooks

GitHub Actions workflows are in `.github/workflows/`: `ci.yml` runs checks for pull requests and pushes to `main`, `version.yml` handles version automation, and `tauri-bundle.yml` builds signed release bundles for `v*` tags. Release builds require the `TAURI_SIGNING_PRIVATE_KEY` repository secret. The pre-commit hook runs `cargo check --workspace --all-targets --all-features --locked --tests`; the pre-push hook runs type checks, Clippy, Rust formatting, and Rust tests. Hooks are installed via `pnpm prepare` (auto-runs on `pnpm install`). `pnpm prepush` also runs lint and frontend tests.
