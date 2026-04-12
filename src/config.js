import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.claude-sessions');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    return { sessions: {}, settings: { locale: 'auto' } };
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// --- Session metadata ---

export function getSessionMeta(sessionId) {
  const config = loadConfig();
  return config.sessions[sessionId] || null;
}

export function setSessionMeta(sessionId, meta) {
  const config = loadConfig();
  config.sessions[sessionId] = {
    ...(config.sessions[sessionId] || {}),
    ...meta,
    updatedAt: new Date().toISOString(),
  };
  saveConfig(config);
}

export function deleteSessionMeta(sessionId) {
  const config = loadConfig();
  delete config.sessions[sessionId];
  saveConfig(config);
}

export function getAllSessionMeta() {
  const config = loadConfig();
  return config.sessions || {};
}

// --- Settings ---

export function getSetting(key) {
  const config = loadConfig();
  return config.settings?.[key];
}

export function setSetting(key, value) {
  const config = loadConfig();
  if (!config.settings) config.settings = {};
  config.settings[key] = value;
  saveConfig(config);
}

// --- Paths ---

export { CONFIG_DIR, CONFIG_FILE };
