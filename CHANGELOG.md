# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- `session-cli` headless binary (`src-tauri/src/bin/cli.rs`) — exposes every backend operation (list, get-config, set-name, set-desc, delete-meta, resume-plan, messages, paths) for scripting, debugging, and CI.
- 15 Rust integration tests (`src-tauri/tests/integration.rs`) covering scanner JSONL parsing, config persistence, settings partial updates, and resume command construction for Windows / macOS / Linux.
- `CLAUDE_SESSION_HOME` environment variable — overrides the home directory used to resolve `~/.claude/projects/` and `~/.claude-sessions/`. Used by the test suite to run against isolated temp dirs.
- `GIT_BASH` environment variable — explicit override for `git-bash.exe` location on Windows.

### Changed
- **Windows: smarter `git-bash.exe` discovery.** Previously hardcoded to `C:\Program Files\Git\git-bash.exe`. Now searches `GIT_BASH` env var, then `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%ProgramW6432%`, `%LOCALAPPDATA%`, with a fallback to `cmd.exe` if Git is not installed.
- `resume.rs` refactored: command construction split into `build_resume_plan()` (pure, testable) and `resume_in_new_terminal()` (spawns the process). Enables headless testing of resume logic without launching real terminals.
- Backend modules in `src-tauri/src/lib.rs` exposed as `pub mod` so external integration tests and the CLI harness can call them directly.

### Fixed
- Adding the `session-cli` binary required `default-run = "claude-session-manager"` in `Cargo.toml`; otherwise `pnpm tauri dev` failed with `cargo run could not determine which binary to run`.

## [0.2.0] — Tauri rewrite

- Full rewrite from terminal UI to a Tauri 2 + React desktop app.
- Adds cloud sync (any locally-mounted cloud folder), auto-summary via Claude Haiku, and i18n (en/ko).

## [0.1.0]

- Initial implementation as a terminal UI.
