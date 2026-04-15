use crate::config::load_config;
use crate::types::Session;
use anyhow::Result;
use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub fn claude_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".claude")
}

pub fn projects_dir() -> PathBuf {
    claude_dir().join("projects")
}

struct JsonlMeta {
    first_timestamp: Option<String>,
    last_timestamp: Option<String>,
    cwd: Option<String>,
    version: Option<String>,
    first_user_message: Option<String>,
    total_lines: usize,
}

fn read_jsonl_meta(path: &PathBuf) -> Result<JsonlMeta> {
    let file = fs::File::open(path)?;
    let reader = BufReader::new(file);

    let mut first_ts = None;
    let mut last_ts = None;
    let mut cwd = None;
    let mut version = None;
    let mut first_user = None;
    let mut total = 0usize;
    let mut head_seen = 0usize;

    for line_res in reader.lines() {
        let Ok(line) = line_res else { continue };
        total += 1;
        let val: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if head_seen < 20 {
            head_seen += 1;
            if first_ts.is_none() {
                first_ts = val.get("timestamp").and_then(|v| v.as_str()).map(String::from);
            }
            if cwd.is_none() {
                cwd = val.get("cwd").and_then(|v| v.as_str()).map(String::from);
            }
            if version.is_none() {
                version = val.get("version").and_then(|v| v.as_str()).map(String::from);
            }
            if first_user.is_none()
                && val.get("type").and_then(|v| v.as_str()) == Some("user")
            {
                if let Some(content) = val.pointer("/message/content") {
                    first_user = extract_text(content).map(|s| truncate(&s, 200));
                }
            }
        }
        if let Some(ts) = val.get("timestamp").and_then(|v| v.as_str()) {
            last_ts = Some(ts.to_string());
        }
    }

    Ok(JsonlMeta {
        first_timestamp: first_ts,
        last_timestamp: last_ts,
        cwd,
        version,
        first_user_message: first_user,
        total_lines: total,
    })
}

fn extract_text(content: &Value) -> Option<String> {
    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }
    if let Some(arr) = content.as_array() {
        for item in arr {
            if item.get("type").and_then(|v| v.as_str()) == Some("text") {
                if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                    return Some(t.to_string());
                }
            }
        }
    }
    None
}

fn truncate(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

fn decode_project_name(dir: &str) -> String {
    let mut s = dir.replace("--", "/");
    if let Some(first) = s.chars().next() {
        if first.is_ascii_uppercase() {
            s = format!("{}:{}", first, &s[1..]);
        }
    }
    s
}

pub fn scan_local_sessions() -> Result<Vec<Session>> {
    let mut out = Vec::new();
    let root = projects_dir();
    if !root.exists() {
        return Ok(out);
    }
    let saved = load_config().sessions;

    for entry in fs::read_dir(&root)? {
        let Ok(entry) = entry else { continue };
        let project_path = entry.path();
        if !project_path.is_dir() {
            continue;
        }
        let project_dir = entry.file_name().to_string_lossy().to_string();

        let Ok(files) = fs::read_dir(&project_path) else { continue };
        for file in files {
            let Ok(file) = file else { continue };
            let path = file.path();
            if path.extension().and_then(|s| s.to_str()) != Some("jsonl") {
                continue;
            }
            let Ok(stat) = fs::metadata(&path) else { continue };
            let Some(stem) = path.file_stem().and_then(|s| s.to_str()).map(String::from) else {
                continue;
            };

            let meta = read_jsonl_meta(&path).ok();
            let saved_meta = saved.get(&stem).cloned().unwrap_or_default();

            out.push(Session {
                session_id: stem,
                name: saved_meta.name,
                description: saved_meta.description,
                auto_summary: saved_meta.auto_summary,
                project: decode_project_name(&project_dir),
                project_dir: project_dir.clone(),
                file_path: path.to_string_lossy().to_string(),
                size: stat.len(),
                total_lines: meta.as_ref().map(|m| m.total_lines).unwrap_or(0),
                first_timestamp: meta.as_ref().and_then(|m| m.first_timestamp.clone()),
                last_timestamp: meta.as_ref().and_then(|m| m.last_timestamp.clone()),
                cwd: meta.as_ref().and_then(|m| m.cwd.clone()),
                version: meta.as_ref().and_then(|m| m.version.clone()),
                first_user_message: meta.as_ref().and_then(|m| m.first_user_message.clone()),
                storage_type: saved_meta.storage_type.unwrap_or_else(|| "local".into()),
            });
        }
    }

    out.sort_by(|a, b| {
        let ta = a.last_timestamp.as_deref().unwrap_or("");
        let tb = b.last_timestamp.as_deref().unwrap_or("");
        tb.cmp(ta)
    });

    Ok(out)
}

pub fn get_session_messages(file_path: &str, max_messages: usize) -> Result<Vec<String>> {
    let file = fs::File::open(file_path)?;
    let reader = BufReader::new(file);
    let mut out = Vec::new();
    for line_res in reader.lines() {
        if out.len() >= max_messages {
            break;
        }
        let Ok(line) = line_res else { continue };
        let Ok(val) = serde_json::from_str::<Value>(&line) else { continue };
        if val.get("type").and_then(|v| v.as_str()) != Some("user") {
            continue;
        }
        if let Some(content) = val.pointer("/message/content") {
            if let Some(text) = extract_text(content) {
                out.push(truncate(&text, 300));
            }
        }
    }
    Ok(out)
}

pub fn delete_session_file(session_id: &str, project_dir: &str) -> Result<()> {
    let path = projects_dir().join(project_dir).join(format!("{}.jsonl", session_id));
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}
