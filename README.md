# Claude Session Manager

A terminal UI for managing [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions — list, name, resume, and sync across devices via Google Drive.

## Features

- **Session list** — View all Claude Code sessions with name, description, project, last activity, and size
- **Quick resume** — Select a session and resume it in the current or a new terminal
- **Name & describe** — Give sessions custom names and descriptions for easy identification
- **Auto-summary** — Generate 1-line summaries using Claude Haiku (cached, only generated once)
- **Google Drive sync** — Upload sessions to Google Drive and resume them from any machine (checkout/checkin pattern)
- **i18n** — English and Korean UI localization with auto-detection

## Installation

```bash
# Clone and install globally
git clone https://github.com/glowElephant/claude-session-manager.git
cd claude-session-manager
npm install
npm link

# One-time setup: installs /session-name command + desktop shortcut
csm-setup
```

That's it. Works on Windows, macOS, and Linux.

## Usage

```bash
# Launch the session manager
csm

# Force language
csm --lang=en
csm --lang=ko
```

### Session List

When launched, the tool scans `~/.claude/projects/` for all session files and displays them in a table:

```
  Claude Session Manager v1.0.0

┌─────┬──────────────────┬──────────────────────┬────────────┬──────────┬────────┬────────┐
│  #  │ Name             │ Description          │ Project    │ Last     │ Size   │ Type   │
├─────┼──────────────────┼──────────────────────┼────────────┼──────────┼────────┼────────┤
│  1  │ auth-refactor    │ Refactoring auth ... │ C:/Git/app │ 2h ago   │ 1.2 MB │ ● Local│
│  2  │ 3fa8c21e         │ GitHub follower ...  │ C:/Git     │ 1d ago   │ 143 KB │ ☁ GDri │
└─────┴──────────────────┴──────────────────────┴────────────┴──────────┴────────┴────────┘
```

### Session Actions

After selecting a session:

- **Resume in current terminal** — Runs `claude --resume <id>` in place
- **Resume in new terminal** — Opens a new terminal window with the session
- **Rename** — Give the session a custom name
- **Edit description** — Add or change the session description
- **Generate summary** — Auto-generate a 1-line summary using Claude Haiku
- **Upload to Google Drive** — Sync the session to the cloud

### Claude Code Skill

If you installed the plugin, the `/session-name` skill is available inside Claude Code:

```
/session-name my-feature
/session-name auth-refactor | Refactoring auth middleware for compliance
```

## Google Drive Setup

Google Drive sync allows you to resume sessions from any machine.

### 1. Create Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Library**
4. Search for and enable **Google Drive API**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **OAuth 2.0 Client ID**
7. Select **Desktop App** as application type
8. Download the credentials JSON file

### 2. Configure in the Tool

```bash
# Option A: Run setup from the CLI
csm --setup-gdrive

# Option B: Use the Settings menu in the TUI
# Select ⚙ Settings → ☁ Google Drive Setup
```

The setup will:
1. Ask for your credentials JSON file path
2. Open a browser for OAuth authorization
3. Store tokens securely in `~/.claude-sessions/`

### How Sync Works

The tool uses a **checkout/checkin** pattern:

1. **Upload** — Copies your local session JSONL + metadata to a `Claude Sessions` folder on Google Drive
2. **Resume from cloud** — Downloads the session to local `~/.claude/projects/`, runs `claude --resume`, then uploads changes back when the session ends

## Configuration

Config is stored at `~/.claude-sessions/config.json`:

```json
{
  "sessions": {
    "abc123-uuid": {
      "name": "my-feature",
      "description": "Working on the new auth flow",
      "autoSummary": "Auth middleware refactoring for compliance",
      "storageType": "local",
      "updatedAt": "2026-04-13T..."
    }
  },
  "settings": {
    "locale": "auto"
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for auto-summary generation (uses Claude Haiku) |
| `CLAUDE_SESSION_LANG` | Override language detection (`en` or `ko`) |

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- (Optional) `ANTHROPIC_API_KEY` for auto-summary
- (Optional) Google Cloud credentials for Drive sync

## License

MIT
