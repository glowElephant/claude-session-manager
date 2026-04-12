import { t } from './i18n/index.js';

/**
 * Format bytes to human-readable size.
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format timestamp to relative time string.
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return '-';

  const now = Date.now();
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diff = now - time;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  const months = Math.floor(diff / 2592000000);

  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  if (days < 7) return t('time.daysAgo', { n: days });
  if (weeks < 5) return t('time.weeksAgo', { n: weeks });
  return t('time.monthsAgo', { n: months });
}

/**
 * Truncate string with ellipsis.
 */
export function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Convert Windows-style project dir name back to path.
 * e.g. "C--Git--myproject" -> "C:/Git/myproject"
 */
export function projectDirToPath(dirName) {
  return dirName.replace(/--/g, '/').replace(/^([A-Z])/, '$1:');
}

/**
 * Format a date string for display.
 */
export function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString();
}
