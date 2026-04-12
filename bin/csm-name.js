#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const args = process.argv.slice(2).join(' ');
if (!args) {
  console.error('Usage: csm-name <name> [| <description>]');
  process.exit(1);
}

// Parse name | description
const parts = args.split('|').map((s) => s.trim());
const name = parts[0];
const description = parts[1] || null;

// Find current session ID from most recent session file
const sessionsDir = join(homedir(), '.claude', 'sessions');
let sessionId = null;

try {
  const files = readdirSync(sessionsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, mtime: statSync(join(sessionsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length > 0) {
    const data = JSON.parse(readFileSync(join(sessionsDir, files[0].name), 'utf-8'));
    sessionId = data.sessionId;
  }
} catch {
  console.error('Failed to find current session');
  process.exit(1);
}

// Read/create config
const configDir = join(homedir(), '.claude-sessions');
const configFile = join(configDir, 'config.json');

if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

let config = { sessions: {}, settings: {} };
if (existsSync(configFile)) {
  config = JSON.parse(readFileSync(configFile, 'utf-8'));
}

// Upsert
config.sessions[sessionId] = {
  ...(config.sessions[sessionId] || {}),
  name,
  ...(description ? { description } : {}),
  updatedAt: new Date().toISOString(),
};

writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');

console.log(`✓ ${sessionId.slice(0, 8)} → ${name}${description ? ` | ${description}` : ''}`);
