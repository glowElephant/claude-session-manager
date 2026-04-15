use crate::config::{load_config, upsert_session_meta};
use crate::scanner::projects_dir;
use crate::types::{Session, SessionMeta};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const CLOUD_FOLDER: &str = "Claude Sessions";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudMeta {
    session_id: String,
    name: Option<String>,
    description: Option<String>,
    auto_summary: Option<String>,
    project: String,
    project_dir: String,
    uploaded_at: String,
}

pub fn cloud_path() -> Option<PathBuf> {
    load_config().settings.cloud_path.map(PathBuf::from)
}

pub fn set_cloud_root(root: &str) -> Result<PathBuf> {
    let root = PathBuf::from(root);
    if !root.exists() {
        return Err(anyhow!("folder not found: {}", root.display()));
    }
    let folder = root.join(CLOUD_FOLDER);
    fs::create_dir_all(&folder)?;
    crate::config::update_settings(crate::types::Settings {
        cloud_path: Some(folder.to_string_lossy().to_string()),
        ..Default::default()
    })?;
    Ok(folder)
}

pub fn upload_session(s: &Session) -> Result<()> {
    let cloud = cloud_path().ok_or_else(|| anyhow!("cloud not configured"))?;
    fs::create_dir_all(&cloud)?;

    let dest = cloud.join(format!("{}.jsonl", s.session_id));
    fs::copy(&s.file_path, &dest)?;

    let meta = CloudMeta {
        session_id: s.session_id.clone(),
        name: s.name.clone(),
        description: s.description.clone(),
        auto_summary: s.auto_summary.clone(),
        project: s.project.clone(),
        project_dir: s.project_dir.clone(),
        uploaded_at: chrono::Utc::now().to_rfc3339(),
    };
    fs::write(
        cloud.join(format!("{}.meta.json", s.session_id)),
        serde_json::to_string_pretty(&meta)?,
    )?;

    upsert_session_meta(
        &s.session_id,
        SessionMeta {
            storage_type: Some("cloud".into()),
            ..Default::default()
        },
    )?;
    Ok(())
}

pub fn list_cloud_sessions() -> Result<Vec<Session>> {
    let Some(cloud) = cloud_path() else { return Ok(vec![]) };
    if !cloud.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(&cloud)? {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|s| s.to_str()) else { continue };
        if !name.ends_with(".meta.json") {
            continue;
        }
        let Ok(body) = fs::read_to_string(&path) else { continue };
        let Ok(meta) = serde_json::from_str::<CloudMeta>(&body) else { continue };
        let jsonl = cloud.join(format!("{}.jsonl", meta.session_id));
        let stat = fs::metadata(&jsonl).ok();
        out.push(Session {
            session_id: meta.session_id.clone(),
            name: meta.name,
            description: meta.description,
            auto_summary: meta.auto_summary,
            project: meta.project,
            project_dir: meta.project_dir,
            file_path: jsonl.to_string_lossy().to_string(),
            size: stat.as_ref().map(|s| s.len()).unwrap_or(0),
            total_lines: 0,
            first_timestamp: None,
            last_timestamp: Some(meta.uploaded_at),
            cwd: None,
            version: None,
            first_user_message: None,
            storage_type: "cloud".into(),
        });
    }
    Ok(out)
}

pub fn checkout(session: &Session) -> Result<String> {
    let cloud = cloud_path().ok_or_else(|| anyhow!("cloud not configured"))?;
    let src = cloud.join(format!("{}.jsonl", session.session_id));
    if !src.exists() {
        return Err(anyhow!("session not found in cloud"));
    }
    let local_dir = projects_dir().join(&session.project_dir);
    fs::create_dir_all(&local_dir)?;
    let dest = local_dir.join(format!("{}.jsonl", session.session_id));
    fs::copy(&src, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

pub fn checkin(session: &Session) -> Result<()> {
    let Some(cloud) = cloud_path() else { return Ok(()) };
    let src = PathBuf::from(&session.file_path);
    if !src.exists() {
        return Ok(());
    }
    let dest = cloud.join(format!("{}.jsonl", session.session_id));
    fs::copy(&src, &dest)?;

    let meta_path = cloud.join(format!("{}.meta.json", session.session_id));
    if meta_path.exists() {
        let body = fs::read_to_string(&meta_path).unwrap_or_default();
        if let Ok(mut meta) = serde_json::from_str::<CloudMeta>(&body) {
            meta.uploaded_at = chrono::Utc::now().to_rfc3339();
            if session.name.is_some() {
                meta.name = session.name.clone();
            }
            if session.description.is_some() {
                meta.description = session.description.clone();
            }
            fs::write(&meta_path, serde_json::to_string_pretty(&meta)?)?;
        }
    }
    Ok(())
}
