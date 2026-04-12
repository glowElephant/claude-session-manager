import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const locales = {
  en: JSON.parse(readFileSync(join(__dirname, 'en.json'), 'utf-8')),
  ko: JSON.parse(readFileSync(join(__dirname, 'ko.json'), 'utf-8')),
};

let currentLocale = 'en';

export function detectLocale() {
  const env = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
  if (env.startsWith('ko')) return 'ko';

  // Windows: check via env or PowerShell culture
  if (process.platform === 'win32') {
    const culture = process.env.CLAUDE_SESSION_LANG;
    if (culture && culture.startsWith('ko')) return 'ko';

    try {
      const result = execSync('powershell -NoProfile -Command "(Get-Culture).Name"', {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
      if (result.startsWith('ko')) return 'ko';
    } catch {
      // ignore
    }
  }

  return 'en';
}

export function setLocale(locale) {
  if (locales[locale]) {
    currentLocale = locale;
  }
}

export function getLocale() {
  return currentLocale;
}

export function t(key, params = {}) {
  const keys = key.split('.');
  let value = locales[currentLocale];

  for (const k of keys) {
    if (value == null) break;
    value = value[k];
  }

  if (typeof value !== 'string') {
    // Fallback to English
    value = locales.en;
    for (const k of keys) {
      if (value == null) return key;
      value = value[k];
    }
    if (typeof value !== 'string') return key;
  }

  // Replace {param} placeholders
  return value.replace(/\{(\w+)\}/g, (_, name) => {
    return params[name] !== undefined ? String(params[name]) : `{${name}}`;
  });
}
