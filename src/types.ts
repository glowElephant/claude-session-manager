export interface Session {
  sessionId: string;
  name: string | null;
  description: string | null;
  autoSummary: string | null;
  project: string;
  projectDir: string;
  filePath: string;
  size: number;
  totalLines: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  cwd: string | null;
  version: string | null;
  firstUserMessage: string | null;
  storageType: string;
}

export interface SessionMeta {
  name?: string | null;
  description?: string | null;
  autoSummary?: string | null;
  storageType?: string | null;
  updatedAt?: string | null;
}

export interface Settings {
  locale?: string | null;
  cloudPath?: string | null;
  anthropicApiKey?: string | null;
}

export interface AppConfig {
  sessions: Record<string, SessionMeta>;
  settings: Settings;
}
