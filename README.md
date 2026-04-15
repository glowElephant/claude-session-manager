# Claude Session Manager

A desktop app for managing [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions — list, name, resume, and sync across devices.

Built with **Tauri 2 + React + TypeScript + Tailwind + shadcn/ui**. Modern dark theme, works on Windows, macOS, Linux.

![dark UI](docs/screenshot.png)

## Features

- **Session list** — All sessions in `~/.claude/projects/` shown with name, description, project, last activity, size, storage type
- **Search & filter** — Instant search across name / description / project / first message
- **Quick resume** — Double-click a row or hit the action menu to open the session in a new terminal (Git Bash on Windows, Terminal on macOS, configurable on Linux)
- **Rename / describe** — Custom names and descriptions persist to `~/.claude-sessions/config.json`
- **Auto-summary** — 1-line summaries via Claude Haiku (cached — generated only once)
- **Cloud sync** — Point at any cloud-synced folder (Google Drive / OneDrive / Dropbox / iCloud / …). Upload + checkout/checkin pattern keeps the source of truth in sync
- **i18n** — English and Korean, auto-detected, overridable in Settings

## Install from source

```bash
git clone https://github.com/glowElephant/claude-session-manager.git
cd claude-session-manager
pnpm install

# Dev mode (hot reload, opens a window)
pnpm tauri dev

# Production build (OS-native installer)
pnpm tauri build
```

Installers land in `src-tauri/target/release/bundle/`:

- Windows: `.msi` / `.exe`
- macOS: `.dmg`
- Linux: `.AppImage` / `.deb`

### Requirements

- **Node.js 18+** and **pnpm**
- **Rust toolchain** (`rustup` — install via <https://rustup.rs>)
- **Tauri 2** platform prerequisites (WebView2 on Windows, Xcode CLT on macOS, webkit2gtk on Linux) — see <https://v2.tauri.app/start/prerequisites/>
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) on `PATH` — required to actually resume sessions
- *(optional)* Anthropic API key in Settings — enables the auto-summary feature

## Configuration

Stored at `~/.claude-sessions/config.json`:

```json
{
  "sessions": {
    "abc123-uuid": {
      "name": "my-feature",
      "description": "Working on the new auth flow",
      "autoSummary": "Refactoring auth middleware for compliance",
      "storageType": "local",
      "updatedAt": "2026-04-15T..."
    }
  },
  "settings": {
    "locale": "en",
    "cloudPath": "G:/My Drive/Claude Sessions",
    "anthropicApiKey": "sk-ant-..."
  }
}
```

The API key is stored locally only; nothing is transmitted except the direct call to `api.anthropic.com` when you request a summary.

## Cloud sync — how it works

1. Open **Settings → Cloud folder → Browse** and pick any cloud-synced local folder (Google Drive desktop, OneDrive, Dropbox, etc.). A `Claude Sessions` subfolder is created there.
2. From the action menu, **Upload to cloud** copies the session JSONL + a `.meta.json` sidecar into that folder. Your cloud app handles syncing.
3. On another machine, install this app and point Settings at the same cloud folder. Uploaded sessions show up with the `cloud` badge.
4. **Resume** on a cloud session auto-checks it out to local `~/.claude/projects/`, runs `claude --resume`, and you can check back in when done.

No vendor-specific APIs, no OAuth. Works with any sync provider that mounts locally.

## Architecture

- `src-tauri/` — Rust backend (Tauri 2). Modules: `scanner`, `config`, `cloud`, `resume`, `summary`, `types`.
- `src/` — React 19 + TypeScript frontend. Tailwind + shadcn-style components in `src/components/ui/`.
- `src/i18n/` — `en.json`, `ko.json` translations.
- IPC: frontend calls Rust via `invoke` (typed wrapper in `src/lib/ipc.ts`).

## License

MIT — see [LICENSE](./LICENSE).
