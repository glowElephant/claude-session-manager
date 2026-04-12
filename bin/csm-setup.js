#!/usr/bin/env node

/**
 * csm setup — one-time setup for any environment.
 * 1. Installs /session-name command to ~/.claude/commands/
 * 2. Creates desktop shortcut (optional)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const skipShortcut = args.includes('--no-shortcut');

// --- 1. Install /session-name command ---
const commandsDir = join(homedir(), '.claude', 'commands');
mkdirSync(commandsDir, { recursive: true });

const commandContent = `Run this command and show the output to the user:

\`\`\`bash
csm-name $ARGUMENTS
\`\`\`
`;

writeFileSync(join(commandsDir, 'session-name.md'), commandContent, 'utf-8');
console.log('✓ /session-name command installed');

// --- 2. Desktop shortcut ---
if (!skipShortcut) {
  let desktop;

  if (process.platform === 'win32') {
    try {
      desktop = execSync(
        'powershell -NoProfile -Command "[Environment]::GetFolderPath(\'Desktop\')"',
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
    } catch {
      desktop = join(homedir(), 'Desktop');
    }

    const batPath = join(desktop, 'Claude Session Manager.bat');
    // Set window size (130 cols x 35 rows) for table display, then run csm
    const batContent = '@echo off\r\nmode con: cols=130 lines=35\r\ncmd /k csm';
    writeFileSync(batPath, batContent, 'utf-8');
    console.log(`✓ Desktop shortcut created: ${batPath}`);

  } else if (process.platform === 'darwin') {
    desktop = join(homedir(), 'Desktop');
    const cmdPath = join(desktop, 'Claude Session Manager.command');
    writeFileSync(cmdPath, '#!/bin/bash\ncsm\n', { mode: 0o755 });
    console.log(`✓ Desktop shortcut created: ${cmdPath}`);

  } else {
    desktop = join(homedir(), 'Desktop');
    const desktopEntry = `[Desktop Entry]
Type=Application
Name=Claude Session Manager
Exec=bash -c "csm"
Terminal=true
Icon=utilities-terminal
`;
    const entryPath = join(desktop, 'claude-session-manager.desktop');
    writeFileSync(entryPath, desktopEntry, { mode: 0o755 });
    console.log(`✓ Desktop shortcut created: ${entryPath}`);
  }
}

console.log('\nSetup complete! Restart Claude Code to use /session-name.');
