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
  preferredTerminal?: TerminalKind | "auto" | string | null;
}

export type TerminalKind =
  | "git-bash"
  | "wt"
  | "powershell"
  | "cmd"
  | "terminal"
  | "linux-default";

export interface DetectedTerminal {
  kind: TerminalKind;
  program: string;
  displayName: string;
}

export interface EnvironmentReport {
  targetOs: "windows" | "macos" | "linux" | string;
  claudeCliFound: boolean;
  claudeCliPath: string | null;
  claudeCliVersion: string | null;
  terminals: DetectedTerminal[];
}

export interface AppConfig {
  sessions: Record<string, SessionMeta>;
  settings: Settings;
}
