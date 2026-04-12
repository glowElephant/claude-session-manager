import { readdirSync, statSync, readFileSync, createReadStream } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { getAllSessionMeta } from './config.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

/**
 * Read the first N and last N lines of a JSONL file efficiently.
 */
async function readJsonlEdges(filePath, { headLines = 5, tailLines = 3 } = {}) {
  const lines = [];
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lines.push(line);
  }

  const head = lines.slice(0, headLines);
  const tail = lines.slice(-tailLines);
  return { head, tail, totalLines: lines.length };
}

/**
 * Extract session metadata from JSONL head/tail lines.
 */
function extractMeta(headLines, tailLines) {
  let firstTimestamp = null;
  let lastTimestamp = null;
  let cwd = null;
  let version = null;
  let firstUserMessage = null;

  for (const line of headLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.timestamp && !firstTimestamp) {
        firstTimestamp = entry.timestamp;
      }
      if (entry.cwd && !cwd) cwd = entry.cwd;
      if (entry.version && !version) version = entry.version;
      if (entry.type === 'user' && !firstUserMessage) {
        const content = entry.message?.content;
        if (typeof content === 'string') {
          firstUserMessage = content.slice(0, 200);
        } else if (Array.isArray(content)) {
          const text = content.find((c) => c.type === 'text');
          if (text) firstUserMessage = text.text.slice(0, 200);
        }
      }
    } catch {
      // skip non-JSON lines
    }
  }

  for (const line of [...tailLines].reverse()) {
    try {
      const entry = JSON.parse(line);
      if (entry.timestamp) {
        lastTimestamp = entry.timestamp;
        break;
      }
    } catch {
      // skip
    }
  }

  return { firstTimestamp, lastTimestamp, cwd, version, firstUserMessage };
}

/**
 * Scan all local sessions from ~/.claude/projects/
 */
export async function scanLocalSessions() {
  const sessions = [];
  const savedMeta = getAllSessionMeta();

  let projectDirs;
  try {
    projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return sessions;
  }

  for (const projectDir of projectDirs) {
    const projectPath = join(PROJECTS_DIR, projectDir.name);
    let files;
    try {
      files = readdirSync(projectPath).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '');
      const filePath = join(projectPath, file);

      try {
        const stat = statSync(filePath);
        const { head, tail, totalLines } = await readJsonlEdges(filePath);
        const meta = extractMeta(head, tail);
        const saved = savedMeta[sessionId] || {};

        sessions.push({
          sessionId,
          name: saved.name || null,
          description: saved.description || null,
          autoSummary: saved.autoSummary || null,
          project: projectDir.name.replace(/--/g, '/').replace(/^([A-Z])/, '$1:'),
          projectDir: projectDir.name,
          filePath,
          size: stat.size,
          totalLines,
          firstTimestamp: meta.firstTimestamp,
          lastTimestamp: meta.lastTimestamp,
          cwd: meta.cwd,
          version: meta.version,
          firstUserMessage: meta.firstUserMessage,
          storageType: saved.storageType || 'local',
        });
      } catch {
        // skip unreadable files
      }
    }
  }

  // Sort by last activity (newest first)
  sessions.sort((a, b) => {
    const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
    const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
    return timeB - timeA;
  });

  return sessions;
}

/**
 * Get user messages from a session for summary generation.
 */
export async function getSessionMessages(filePath, maxMessages = 5) {
  const messages = [];
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (messages.length >= maxMessages) break;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user') {
        const content = entry.message?.content;
        if (typeof content === 'string') {
          messages.push(content.slice(0, 300));
        } else if (Array.isArray(content)) {
          const text = content.find((c) => c.type === 'text');
          if (text) messages.push(text.text.slice(0, 300));
        }
      }
    } catch {
      // skip
    }
  }

  return messages;
}

export { CLAUDE_DIR, PROJECTS_DIR };
