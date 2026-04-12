import { getSessionMeta, setSessionMeta } from './config.js';
import { getSessionMessages } from './scanner.js';

/**
 * Generate a 1-line summary for a session using Anthropic API (Haiku).
 * Caches the result in config so it's only generated once.
 */
export async function generateSummary(session) {
  // Return cached summary if available
  const meta = getSessionMeta(session.sessionId);
  if (meta?.autoSummary) return meta.autoSummary;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const messages = await getSessionMessages(session.filePath, 5);
  if (messages.length === 0) return null;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Summarize what this coding session is about in exactly 1 short sentence (under 80 chars). Based on these user messages:\n\n${messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`,
        },
      ],
    });

    const summary = response.content[0]?.text?.trim();
    if (summary) {
      setSessionMeta(session.sessionId, { autoSummary: summary });
      return summary;
    }
  } catch {
    // API call failed, return null
  }

  return null;
}

/**
 * Generate summaries for all sessions that don't have one yet.
 */
export async function generateMissingSummaries(sessions, { onProgress } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  let done = 0;
  for (const session of sessions) {
    const meta = getSessionMeta(session.sessionId);
    if (meta?.autoSummary || meta?.description) {
      done++;
      continue;
    }

    const summary = await generateSummary(session);
    if (summary) session.autoSummary = summary;
    done++;
    onProgress?.(done, sessions.length);
  }
}
