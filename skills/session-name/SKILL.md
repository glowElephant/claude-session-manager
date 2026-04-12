---
name: session-name
description: Name and describe the current Claude Code session for the session manager. Use when user wants to label or tag the current session.
user_invocable: true
---

# Session Name Skill

The user wants to name or describe the current session for the Claude Session Manager (`csm`).

## How to get the current session ID

The session ID is embedded in every JSONL entry of the current conversation. To find it:

1. Look at the `~/.claude/sessions/` directory for `.json` files.
2. Each file is `<PID>.json` containing `{ "sessionId": "...", "pid": ..., "startedAt": ... }`.
3. Find the session file with the most recent `startedAt` timestamp — that is the current session.
4. Read its `sessionId` field.

```bash
# Find the most recently modified session file to get the current session ID
ls -t ~/.claude/sessions/*.json | head -1 | xargs cat
```

## How to parse user input

- Format: `/session-name <name>` or `/session-name <name> | <description>`
- `|` is the separator between name and description.
- If no arguments provided, ask the user what they want to name this session.

## How to save

Read `~/.claude-sessions/config.json`, merge the session entry, and write back.

If the file doesn't exist, create it with this structure:
```json
{
  "sessions": {},
  "settings": {}
}
```

Upsert into `sessions`:
```json
{
  "sessions": {
    "<sessionId>": {
      "name": "<name>",
      "description": "<description or null>",
      "updatedAt": "<ISO 8601 timestamp>"
    }
  }
}
```

Preserve any existing fields (like `autoSummary`, `storageType`) when updating — only overwrite `name`, `description`, and `updatedAt`.

## After saving

Confirm to the user:
- Session ID (first 8 chars)
- Name that was set
- Description (if provided)

## Example usage

- `/session-name my-feature` → name: "my-feature"
- `/session-name auth-refactor | Refactoring auth middleware` → name: "auth-refactor", description: "Refactoring auth middleware"
- `/session-name` → Ask user for a name
