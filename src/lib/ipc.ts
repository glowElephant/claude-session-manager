import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Session, SessionMeta, Settings } from "@/types";

export const ipc = {
  listSessions: () => invoke<Session[]>("list_sessions"),
  getConfig: () => invoke<AppConfig>("get_config_cmd"),
  saveSessionMeta: (sessionId: string, patch: SessionMeta) =>
    invoke<void>("save_session_meta", { sessionId, patch }),
  deleteSession: (sessionId: string, projectDir: string) =>
    invoke<void>("delete_session", { sessionId, projectDir }),
  saveSettings: (patch: Settings) => invoke<void>("save_settings", { patch }),
  setCloudFolder: (root: string) =>
    invoke<string>("set_cloud_folder", { root }),
  uploadToCloud: (session: Session) =>
    invoke<void>("upload_to_cloud", { session }),
  checkoutSession: (session: Session) =>
    invoke<string>("checkout_session", { session }),
  checkinSession: (session: Session) =>
    invoke<void>("checkin_session", { session }),
  resumeSession: (sessionId: string, cwd: string | null) =>
    invoke<void>("resume_session", { sessionId, cwd }),
  generateSummary: (sessionId: string, filePath: string) =>
    invoke<string>("generate_summary_cmd", { sessionId, filePath }),
};
