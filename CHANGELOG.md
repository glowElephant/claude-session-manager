# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- **Multi-terminal support on Windows.** Auto-detects Git Bash, Windows Terminal (`wt.exe`), PowerShell (`pwsh`/`powershell`), and Command Prompt. Each terminal gets a tailored launch command (e.g. `wt new-tab -d <cwd> powershell -NoExit -Command claude --resume <id>`).
- **Settings → Preferred terminal** dropdown lets users pin a specific terminal or stick with auto-detect. Persisted in `config.json` as `preferredTerminal`.
- **Settings → Environment diagnostics** — one-click "Run diagnostics" shows whether `claude` is on `PATH` (with version + path) and lists every detected terminal with its resolved location.
- **Warning banner** at the top of the app when `claude` CLI is not found on PATH, with a link to the install guide.
- `check_environment_cmd` Tauri command + `EnvironmentReport` IPC type for the diagnostics feature.
- `terminal.rs` module — `TerminalKind` enum, `detect_all_terminals()`, `pick_terminal()`, `build_resume_command()` (pure, fully unit-testable per terminal kind).
- `environment.rs` module — `check_environment()` resolves `claude` from `PATH` (handles `.exe`/`.cmd`/`.bat`) and runs `claude --version` with a 5-second timeout.
- `WINDOWS_TERMINAL` environment variable — explicit override for `wt.exe` location.
- `session-cli check-env` and `session-cli set-terminal <kind>` subcommands.
- `session-cli` headless binary (`src-tauri/src/bin/cli.rs`) — exposes every backend operation (list, get-config, set-name, set-desc, delete-meta, resume-plan, messages, paths, check-env, set-terminal) for scripting, debugging, and CI.
- 21 Rust integration tests (`src-tauri/tests/integration.rs`) — scanner JSONL parsing, config persistence, settings partial updates, terminal command building per kind, terminal alias parsing, environment diagnostics consistency.
- `CLAUDE_SESSION_HOME` environment variable — overrides the home directory used to resolve `~/.claude/projects/` and `~/.claude-sessions/`. Used by the test suite to run against isolated temp dirs.
- `GIT_BASH` environment variable — explicit override for `git-bash.exe` location on Windows.

### Changed
- **Windows: smarter `git-bash.exe` discovery.** Previously hardcoded to `C:\Program Files\Git\git-bash.exe`. Now searches `GIT_BASH` env var, then `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%ProgramW6432%`, `%LOCALAPPDATA%`, with a fallback to `cmd.exe` if Git is not installed.
- `resume.rs` refactored: terminal selection moved to `terminal.rs`, command construction split into `build_resume_plan()` (pure, testable) and `resume_in_new_terminal()` (spawns the process). Enables headless testing of resume logic without launching real terminals.
- Backend modules in `src-tauri/src/lib.rs` exposed as `pub mod` so external integration tests and the CLI harness can call them directly.

### Fixed
- Adding the `session-cli` binary required `default-run = "claude-session-manager"` in `Cargo.toml`; otherwise `pnpm tauri dev` failed with `cargo run could not determine which binary to run`.

## [0.2.0] — Tauri rewrite

- Full rewrite from terminal UI to a Tauri 2 + React desktop app.
- Adds cloud sync (any locally-mounted cloud folder), auto-summary via Claude Haiku, and i18n (en/ko).

## [0.1.0]

- Initial implementation as a terminal UI.
