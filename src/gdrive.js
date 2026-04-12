import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { select, input } from '@inquirer/prompts';
import { PROJECTS_DIR } from './scanner.js';
import { getSetting, setSetting, setSessionMeta } from './config.js';
import { t } from './i18n/index.js';

const CLOUD_FOLDER_NAME = 'Claude Sessions';

/**
 * Get the configured cloud sync folder path.
 */
export function getCloudPath() {
  return getSetting('cloudPath') || null;
}

/**
 * Check if cloud sync is configured.
 */
export function isCloudConfigured() {
  const p = getCloudPath();
  return p && existsSync(p);
}

/**
 * Setup: just ask for the local path to the cloud-synced folder.
 * e.g. Google Drive: G:\My Drive, OneDrive: C:\Users\xxx\OneDrive, Dropbox, etc.
 */
export async function setupCloud() {
  console.log();
  console.log(t('gdrive.setupTitle'));
  console.log('─'.repeat(50));
  console.log(t('gdrive.setupInstructions'));
  console.log();

  const folderPath = await input({ message: t('gdrive.enterFolderPath') });
  const trimmed = folderPath.trim();

  if (!existsSync(trimmed)) {
    console.log(t('gdrive.folderNotFound', { path: trimmed }));
    return false;
  }

  // Create a "Claude Sessions" subfolder
  const sessionFolder = join(trimmed, CLOUD_FOLDER_NAME);
  if (!existsSync(sessionFolder)) {
    mkdirSync(sessionFolder, { recursive: true });
  }

  setSetting('cloudPath', sessionFolder);
  console.log(`\n✓ ${t('gdrive.setupComplete')}: ${sessionFolder}`);
  return true;
}

/**
 * Upload (copy) a session to the cloud folder.
 */
export function uploadSession(session) {
  const cloudPath = getCloudPath();
  if (!cloudPath) throw new Error(t('gdrive.notConfigured'));

  // Copy JSONL file
  const destFile = join(cloudPath, `${session.sessionId}.jsonl`);
  copyFileSync(session.filePath, destFile);

  // Copy metadata
  const meta = {
    sessionId: session.sessionId,
    name: session.name,
    description: session.description,
    autoSummary: session.autoSummary,
    project: session.project,
    projectDir: session.projectDir,
    uploadedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(cloudPath, `${session.sessionId}.meta.json`),
    JSON.stringify(meta, null, 2),
    'utf-8'
  );

  setSessionMeta(session.sessionId, { storageType: 'cloud' });
}

/**
 * List sessions in the cloud folder.
 */
export function listCloudSessions() {
  const cloudPath = getCloudPath();
  if (!cloudPath || !existsSync(cloudPath)) return [];

  const sessions = [];
  const metaFiles = readdirSync(cloudPath).filter((f) => f.endsWith('.meta.json'));

  for (const metaFile of metaFiles) {
    try {
      const meta = JSON.parse(readFileSync(join(cloudPath, metaFile), 'utf-8'));
      const jsonlFile = join(cloudPath, `${meta.sessionId}.jsonl`);
      const stat = existsSync(jsonlFile) ? statSync(jsonlFile) : null;

      sessions.push({
        sessionId: meta.sessionId,
        name: meta.name,
        description: meta.description,
        autoSummary: meta.autoSummary,
        project: meta.project,
        projectDir: meta.projectDir,
        size: stat?.size || 0,
        lastTimestamp: meta.uploadedAt || stat?.mtime?.toISOString(),
        storageType: 'cloud',
        filePath: existsSync(jsonlFile) ? jsonlFile : null,
      });
    } catch {
      // skip
    }
  }

  return sessions;
}

/**
 * Checkout: copy cloud session to local ~/.claude/projects/ for resume.
 */
export function checkoutSession(session) {
  const cloudPath = getCloudPath();
  if (!cloudPath) throw new Error(t('gdrive.notConfigured'));

  const cloudFile = join(cloudPath, `${session.sessionId}.jsonl`);
  if (!existsSync(cloudFile)) throw new Error(t('error.sessionNotFound'));

  const projectDir = session.projectDir || 'unknown';
  const localProjectDir = join(PROJECTS_DIR, projectDir);
  mkdirSync(localProjectDir, { recursive: true });

  const localPath = join(localProjectDir, `${session.sessionId}.jsonl`);
  copyFileSync(cloudFile, localPath);

  session.filePath = localPath;
  return localPath;
}

/**
 * Checkin: copy updated local session back to cloud folder.
 */
export function checkinSession(session) {
  if (!session.filePath || !existsSync(session.filePath)) return;

  const cloudPath = getCloudPath();
  if (!cloudPath) return;

  const destFile = join(cloudPath, `${session.sessionId}.jsonl`);
  copyFileSync(session.filePath, destFile);

  // Update meta
  const metaFile = join(cloudPath, `${session.sessionId}.meta.json`);
  if (existsSync(metaFile)) {
    const meta = JSON.parse(readFileSync(metaFile, 'utf-8'));
    meta.uploadedAt = new Date().toISOString();
    meta.name = session.name || meta.name;
    meta.description = session.description || meta.description;
    writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8');
  }
}
