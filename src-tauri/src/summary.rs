use anyhow::{anyhow, Result};
use serde_json::json;

const MODEL: &str = "claude-haiku-4-5-20251001";
const ENDPOINT: &str = "https://api.anthropic.com/v1/messages";

pub async fn generate_summary(api_key: &str, messages: &[String]) -> Result<String> {
    if messages.is_empty() {
        return Err(anyhow!("no messages to summarize"));
    }
    let joined = messages
        .iter()
        .enumerate()
        .map(|(i, m)| format!("[{}] {}", i + 1, m))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "Summarize what this coding session is about in exactly 1 short sentence (under 80 chars). Reply with just the sentence.\n\nUser messages:\n{}",
        joined
    );

    let client = reqwest::Client::new();
    let body = json!({
        "model": MODEL,
        "max_tokens": 120,
        "messages": [{"role": "user", "content": prompt}]
    });

    let resp = client
        .post(ENDPOINT)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(anyhow!("anthropic api error {}: {}", status, text));
    }

    let val: serde_json::Value = resp.json().await?;
    let text = val
        .pointer("/content/0/text")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("missing content in response"))?;
    Ok(text.trim().to_string())
}
