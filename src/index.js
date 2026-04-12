import chalk from 'chalk';
import Table from 'cli-table3';
import { select, input, confirm } from '@inquirer/prompts';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';

import { t, setLocale, detectLocale } from './i18n/index.js';
import { scanLocalSessions } from './scanner.js';
import { getSessionMeta, setSessionMeta, deleteSessionMeta, getSetting, setSetting } from './config.js';
import { generateSummary } from './summary.js';
import { isCloudConfigured, setupCloud, listCloudSessions, uploadSession, checkoutSession, checkinSession } from './gdrive.js';
import { formatSize, formatRelativeTime, truncate } from './utils.js';

const VERSION = '1.0.0';

/**
 * Merge local and cloud sessions, deduplicating by sessionId.
 */
async function getAllSessions() {
  const local = await scanLocalSessions();
  let cloud = [];

  if (isCloudConfigured()) {
    try {
      cloud = listCloudSessions();
    } catch {
      // silently skip
    }
  }

  const map = new Map();
  for (const s of local) map.set(s.sessionId, s);
  for (const s of cloud) {
    if (!map.has(s.sessionId)) {
      map.set(s.sessionId, s);
    }
  }

  const sessions = [...map.values()];
  sessions.sort((a, b) => {
    const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
    const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
    return timeB - timeA;
  });

  return sessions;
}

/**
 * Display sessions in a table.
 */
function displaySessionTable(sessions) {
  const table = new Table({
    head: [
      chalk.cyan('#'),
      chalk.cyan(t('list.name')),
      chalk.cyan(t('list.description')),
      chalk.cyan(t('list.project')),
      chalk.cyan(t('list.lastActive')),
      chalk.cyan(t('list.size')),
      chalk.cyan(t('list.type')),
    ],
    colWidths: [5, 18, 36, 20, 14, 10, 8],
    wordWrap: true,
    style: { head: [], border: ['gray'] },
  });

  sessions.forEach((s, i) => {
    const desc = s.description || s.autoSummary || truncate(s.firstUserMessage, 34) || '-';
    const typeIcon = s.storageType === 'cloud' ? chalk.yellow('☁') : chalk.green('●');
    const typeName = s.storageType === 'cloud' ? 'Cloud' : t('storage.local');

    table.push([
      chalk.gray(i + 1),
      chalk.white(truncate(s.name || s.sessionId.slice(0, 8), 16)),
      chalk.gray(truncate(desc, 34)),
      chalk.blue(truncate(s.project, 18)),
      chalk.yellow(formatRelativeTime(s.lastTimestamp)),
      chalk.gray(formatSize(s.size || 0)),
      `${typeIcon} ${typeName}`,
    ]);
  });

  console.log();
  console.log(
    chalk.bold(`  ${t('app.title')}`) + chalk.gray(` ${t('app.version', { version: VERSION })}`)
  );
  console.log();
  console.log(table.toString());
  console.log(chalk.gray(`  ${t('list.total', { count: sessions.length })}`));
  console.log();
}

/**
 * Show session detail view.
 */
function displaySessionDetail(session) {
  console.log();
  console.log(chalk.bold(`  ${t('list.sessionId')}: `) + chalk.white(session.sessionId));
  console.log(chalk.bold(`  ${t('list.name')}:      `) + chalk.white(session.name || '-'));
  console.log(
    chalk.bold(`  ${t('list.description')}: `) +
      chalk.white(session.description || session.autoSummary || '-')
  );
  console.log(chalk.bold(`  ${t('list.project')}:  `) + chalk.blue(session.project));
  console.log(
    chalk.bold(`  ${t('list.lastActive')}: `) +
      chalk.yellow(formatRelativeTime(session.lastTimestamp))
  );
  console.log(chalk.bold(`  ${t('list.size')}:      `) + chalk.gray(formatSize(session.size || 0)));

  const typeLabel = session.storageType === 'cloud' ? 'Cloud' : t('storage.local');
  console.log(chalk.bold(`  ${t('list.type')}:      `) + chalk.white(typeLabel));

  if (session.cwd) {
    console.log(chalk.bold('  CWD:       ') + chalk.gray(session.cwd));
  }
  console.log();
}

/**
 * Start a new Claude Code session.
 */
async function startNewSession(mode) {
  if (mode === 'current') {
    const child = spawn('claude', [], { stdio: 'inherit', shell: true });
    await new Promise((resolve) => child.on('close', resolve));
  } else {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', 'cmd', '/k', 'claude'], { shell: true, detached: true });
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', 'tell app "Terminal" to do script "claude"'], { detached: true });
    } else {
      spawn('bash', ['-c', 'claude'], { detached: true, stdio: 'ignore' });
    }
  }
}

/**
 * Resume a session.
 */
async function resumeSession(session, mode) {
  // If cloud session, checkout first
  if (session.storageType === 'cloud' && !session.filePath) {
    console.log(chalk.yellow(`  ${t('storage.checkingOut')}`));
    checkoutSession(session);
  }

  if (mode === 'current') {
    const child = spawn('claude', ['--resume', session.sessionId], {
      stdio: 'inherit',
      shell: true,
    });

    await new Promise((resolve) => child.on('close', resolve));

    // If cloud session, checkin after session ends
    if (session.storageType === 'cloud') {
      console.log(chalk.yellow(`\n  ${t('storage.checkingIn')}`));
      try {
        checkinSession(session);
        console.log(chalk.green(`  ${t('storage.uploaded')}`));
      } catch (err) {
        console.error(chalk.red(`  ${t('error.resumeFailed', { error: err.message })}`));
      }
    }
  } else {
    const cmd = `claude --resume ${session.sessionId}`;
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', 'cmd', '/k', cmd], { shell: true, detached: true });
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', `tell app "Terminal" to do script "${cmd}"`], { detached: true });
    } else {
      spawn('bash', ['-c', cmd], { detached: true, stdio: 'ignore' });
    }
  }
}

/**
 * Session action menu.
 */
async function sessionActionMenu(session) {
  displaySessionDetail(session);

  const choices = [
    { name: `▶ ${t('action.resumeHere')}`, value: 'resume_here' },
    { name: `◆ ${t('action.resumeNew')}`, value: 'resume_new' },
    { name: `✎ ${t('action.rename')}`, value: 'rename' },
    { name: `✎ ${t('action.describe')}`, value: 'describe' },
    { name: `★ ${t('action.generateSummary')}`, value: 'summary' },
  ];

  if (isCloudConfigured() && session.storageType !== 'cloud') {
    choices.push({ name: `☁ ${t('action.syncToCloud')}`, value: 'upload' });
  }

  choices.push(
    { name: `← ${t('action.back')}`, value: 'back' },
    { name: `✗ ${t('action.quit')}`, value: 'quit' }
  );

  const action = await select({ message: t('prompt.selectAction'), choices });

  switch (action) {
    case 'resume_here':
      await resumeSession(session, 'current');
      return 'quit';

    case 'resume_new':
      await resumeSession(session, 'new');
      return 'back';

    case 'rename': {
      const name = await input({ message: t('prompt.enterName'), default: session.name || '' });
      if (name.trim()) {
        setSessionMeta(session.sessionId, { name: name.trim() });
        session.name = name.trim();
      }
      return 'stay';
    }

    case 'describe': {
      const desc = await input({ message: t('prompt.enterDescription'), default: session.description || '' });
      if (desc.trim()) {
        setSessionMeta(session.sessionId, { description: desc.trim() });
        session.description = desc.trim();
      }
      return 'stay';
    }

    case 'summary': {
      console.log(chalk.yellow(`  ${t('summary.generating')}`));
      const summary = await generateSummary(session);
      if (summary) {
        session.autoSummary = summary;
        console.log(chalk.green(`  ${t('summary.generated')}: ${summary}`));
      } else {
        console.log(chalk.red(`  ${t('summary.failed')}`));
        if (!process.env.ANTHROPIC_API_KEY) {
          console.log(chalk.yellow(`  ${t('summary.noApiKey')}`));
        }
      }
      return 'stay';
    }

    case 'upload': {
      console.log(chalk.yellow(`  ${t('storage.syncing')}`));
      try {
        uploadSession(session);
        session.storageType = 'cloud';
        console.log(chalk.green(`  ${t('storage.uploaded')}`));
      } catch (err) {
        console.error(chalk.red(`  Error: ${err.message}`));
      }
      return 'stay';
    }

    case 'back':
      return 'back';

    case 'quit':
      return 'quit';
  }
}

/**
 * Settings menu.
 */
async function settingsMenu() {
  const choices = [
    { name: `🌐 Language: ${getSetting('locale') || 'auto'}`, value: 'locale' },
  ];

  if (!isCloudConfigured()) {
    choices.push({ name: `☁ ${t('gdrive.setupTitle')}`, value: 'cloud_setup' });
  } else {
    choices.push({ name: `☁ Cloud (configured ✓)`, value: 'cloud_info' });
  }

  choices.push({ name: `← ${t('action.back')}`, value: 'back' });

  const action = await select({ message: 'Settings', choices });

  switch (action) {
    case 'locale': {
      const locale = await select({
        message: 'Select language',
        choices: [
          { name: 'Auto-detect', value: 'auto' },
          { name: 'English', value: 'en' },
          { name: '한국어', value: 'ko' },
        ],
      });
      setSetting('locale', locale);
      setLocale(locale === 'auto' ? detectLocale() : locale);
      break;
    }

    case 'cloud_setup':
      await setupCloud();
      break;

    case 'cloud_info':
      console.log(chalk.green('\n  Cloud storage is configured and ready.'));
      break;
  }
}

/**
 * Main application loop.
 */
export async function main() {
  // Detect locale
  const savedLocale = getSetting('locale');
  if (savedLocale && savedLocale !== 'auto') {
    setLocale(savedLocale);
  } else {
    setLocale(detectLocale());
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  if (args.includes('--lang=ko')) setLocale('ko');
  if (args.includes('--lang=en')) setLocale('en');
  if (args.includes('--setup-cloud')) {
    await setupCloud();
    return;
  }

  let running = true;

  while (running) {
    console.clear();

    console.log(chalk.yellow(`  ${t('list.scanning')}`));
    const sessions = await getAllSessions();

    console.clear();
    displaySessionTable(sessions);

    // Build choices
    const sessionChoices = sessions.map((s, i) => {
      const label = s.name || s.sessionId.slice(0, 8);
      const desc = s.description || s.autoSummary || truncate(s.firstUserMessage, 40) || '';
      const time = formatRelativeTime(s.lastTimestamp);
      const typeIcon = s.storageType === 'cloud' ? '☁' : '●';

      return {
        name: `${typeIcon} ${label}  ${chalk.gray(truncate(desc, 40))}  ${chalk.yellow(time)}`,
        value: i,
      };
    });

    sessionChoices.push(
      { name: `+ ${t('action.newSession')}`, value: 'new_session' },
      { name: `⚙ Settings`, value: 'settings' },
      { name: `✗ ${t('action.quit')}`, value: 'quit' }
    );

    const choice = await select({
      message: t('action.select'),
      choices: sessionChoices,
      pageSize: 20,
    });

    if (choice === 'quit') {
      running = false;
      break;
    }

    if (choice === 'new_session') {
      const mode = await select({
        message: t('prompt.selectTerminal'),
        choices: [
          { name: `▶ ${t('action.resumeHere')}`, value: 'current' },
          { name: `◆ ${t('action.resumeNew')}`, value: 'new' },
        ],
      });
      await startNewSession(mode);
      if (mode === 'current') {
        running = false;
      }
      continue;
    }

    if (choice === 'settings') {
      await settingsMenu();
      continue;
    }

    // Session selected
    const session = sessions[choice];
    let result = 'stay';

    while (result === 'stay') {
      console.clear();
      result = await sessionActionMenu(session);
    }

    if (result === 'quit') {
      running = false;
    }
  }
}
