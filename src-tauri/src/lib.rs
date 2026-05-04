pub mod cloud;
pub mod config;
pub mod environment;
pub mod resume;
pub mod scanner;
pub mod summary;
pub mod terminal;
pub mod types;

use crate::config::{
    delete_session_meta as cfg_delete_meta, load_config, update_settings, upsert_session_meta,
};
use crate::types::{Config, Session, SessionMeta, Settings};

fn to_str<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn list_sessions() -> Result<Vec<Session>, String> {
    let mut local = scanner::scan_local_sessions().map_err(to_str)?;
    let cloud_only: Vec<Session> = cloud::list_cloud_sessions()
        .unwrap_or_default()
        .into_iter()
        .filter(|c| !local.iter().any(|l| l.session_id == c.session_id))
        .collect();
    local.extend(cloud_only);
    Ok(local)
}

#[tauri::command]
fn get_config_cmd() -> Config {
    load_config()
}

#[tauri::command]
fn save_session_meta(session_id: String, patch: SessionMeta) -> Result<(), String> {
    upsert_session_meta(&session_id, patch).map_err(to_str)
}

#[tauri::command]
fn delete_session(session_id: String, project_dir: String) -> Result<(), String> {
    scanner::delete_session_file(&session_id, &project_dir).map_err(to_str)?;
    cfg_delete_meta(&session_id).map_err(to_str)
}

#[tauri::command]
fn save_settings(patch: Settings) -> Result<(), String> {
    update_settings(patch).map_err(to_str)
}

#[tauri::command]
fn set_cloud_folder(root: String) -> Result<String, String> {
    cloud::set_cloud_root(&root)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(to_str)
}

#[tauri::command]
fn upload_to_cloud(session: Session) -> Result<(), String> {
    cloud::upload_session(&session).map_err(to_str)
}

#[tauri::command]
fn checkout_session(session: Session) -> Result<String, String> {
    cloud::checkout(&session).map_err(to_str)
}

#[tauri::command]
fn checkin_session(session: Session) -> Result<(), String> {
    cloud::checkin(&session).map_err(to_str)
}

#[tauri::command]
fn resume_session(session_id: String, cwd: Option<String>) -> Result<(), String> {
    resume::resume_in_new_terminal(&session_id, cwd.as_deref()).map_err(to_str)
}

#[tauri::command]
fn check_environment_cmd() -> environment::EnvironmentReport {
    environment::check_environment()
}

#[tauri::command]
async fn generate_summary_cmd(
    session_id: String,
    file_path: String,
) -> Result<String, String> {
    let cfg = load_config();
    let key = cfg
        .settings
        .anthropic_api_key
        .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
        .ok_or_else(|| "ANTHROPIC_API_KEY not configured".to_string())?;

    let msgs = scanner::get_session_messages(&file_path, 5).map_err(to_str)?;
    let summary = summary::generate_summary(&key, &msgs).await.map_err(to_str)?;

    upsert_session_meta(
        &session_id,
        SessionMeta {
            auto_summary: Some(summary.clone()),
            ..Default::default()
        },
    )
    .map_err(to_str)?;

    Ok(summary)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_sessions,
            get_config_cmd,
            save_session_meta,
            delete_session,
            save_settings,
            set_cloud_folder,
            upload_to_cloud,
            checkout_session,
            checkin_session,
            resume_session,
            check_environment_cmd,
            generate_summary_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
