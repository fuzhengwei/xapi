use crate::db::models::{Channel, CreateChannelInput};
use crate::db::repository::Repository;
use crate::AppState;
use serde::{Deserialize, Serialize};

// ─── Export types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct WaliapiExport {
    pub version: String,
    pub exported_at: String,
    pub r#type: String,
    pub channels: Vec<ExportedChannel>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedChannel {
    pub name: String,
    pub r#type: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub status: i64,
    pub priority: i64,
    pub weight: i64,
    pub config: serde_json::Value,
    pub model_mapping: serde_json::Value,
}

impl From<Channel> for ExportedChannel {
    fn from(c: Channel) -> Self {
        ExportedChannel {
            name: c.name,
            r#type: c.channel_type,
            base_url: c.base_url,
            api_key: c.api_key,
            models: serde_json::from_str(&c.models).unwrap_or_default(),
            status: c.status,
            priority: c.priority,
            weight: c.weight,
            config: serde_json::from_str(&c.config).unwrap_or(serde_json::Value::Object(Default::default())),
            model_mapping: serde_json::from_str(&c.model_mapping).unwrap_or(serde_json::Value::Object(Default::default())),
        }
    }
}

// ─── Walicode backup types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalicodeBackup {
    pub version: serde_json::Value,
    pub r#type: Option<String>,
    #[serde(default)]
    pub ai_settings: Option<WalicodeAiSettings>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalicodeAiSettings {
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub provider_type: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub custom_models: Option<Vec<String>>,
    #[serde(default)]
    pub custom_providers: Option<Vec<WalicodeProvider>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalicodeProvider {
    pub name: String,
    #[serde(default)]
    pub api_key: Option<String>,
    pub base_url: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub custom_models: Option<Vec<String>>,
    #[serde(default)]
    pub api_format: Option<String>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

// ─── Scan result types ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub sources: Vec<ScannedSource>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScannedSource {
    pub source: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub models: Vec<String>,
    pub api_format: String,
    pub raw: serde_json::Value,
}

// ─── Import result types ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

// ─── Commands ───────────────────────────────────────────────────────────────

/// Export all channels as a waliapi JSON backup
#[tauri::command]
pub async fn export_channels(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<String, String> {
    let repo = Repository::new(state.db.pool.clone());
    let channels = repo.get_all_channels().await.map_err(|e| e.to_string())?;

    let export = WaliapiExport {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        r#type: "waliapi-export".to_string(),
        channels: channels.into_iter().map(ExportedChannel::from).collect(),
    };

    serde_json::to_string_pretty(&export).map_err(|e| e.to_string())
}

/// Import channels from a walicode-full-backup.json file content
#[tauri::command]
pub async fn import_walicode_backup(
    content: String,
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<ImportResult, String> {
    let backup: WalicodeBackup =
        serde_json::from_str(&content).map_err(|e| format!("解析 walicode 备份文件失败: {}", e))?;

    let repo = Repository::new(state.db.pool.clone());
    let existing = repo.get_all_channels().await.map_err(|e| e.to_string())?;
    let existing_names: std::collections::HashSet<String> =
        existing.iter().map(|c| c.name.clone()).collect();

    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();

    // Import main aiSettings as a channel
    if let Some(ai) = &backup.ai_settings {
        if let (Some(api_key), Some(base_url)) = (ai.api_key.as_ref(), ai.base_url.as_ref()) {
            if !api_key.is_empty() && !base_url.is_empty() {
                let name = "walicode-default".to_string();
                if existing_names.contains(&name) {
                    skipped += 1;
                } else {
                    let models = ai.custom_models.clone().unwrap_or_default();
                    let models = if models.is_empty() {
                        ai.model.clone().into_iter().collect()
                    } else {
                        models
                    };

                    let channel_type = guess_channel_type(
                        base_url,
                        ai.provider_type.as_deref(),
                    );

                    let input = CreateChannelInput {
                        name,
                        channel_type,
                        base_url: base_url.clone(),
                        api_key: api_key.clone(),
                        models,
                        priority: Some(0),
                        weight: Some(1),
                        config: None,
                        model_mapping: None,
                    };

                    match repo.create_channel(&input).await {
                        Ok(_) => imported += 1,
                        Err(e) => errors.push(format!("导入 walicode 默认渠道失败: {}", e)),
                    }
                }
            }
        }

        // Import custom providers
        if let Some(providers) = &ai.custom_providers {
            for p in providers {
                let name = p.name.clone();
                if existing_names.contains(&name) {
                    skipped += 1;
                    continue;
                }

                let api_key = p.api_key.clone().unwrap_or_default();
                if api_key.is_empty() && !p.base_url.contains("localhost") && !p.base_url.contains("127.0.0.1") {
                    skipped += 1;
                    continue;
                }

                let models = p.custom_models.clone().unwrap_or_default();
                let models = if models.is_empty() {
                    p.model.clone().into_iter().collect()
                } else {
                    models
                };

                let channel_type = guess_channel_type(
                    &p.base_url,
                    p.api_format.as_deref(),
                );

                let input = CreateChannelInput {
                    name,
                    channel_type,
                    base_url: p.base_url.clone(),
                    api_key,
                    models,
                    priority: Some(0),
                    weight: Some(1),
                    config: None,
                    model_mapping: None,
                };

                match repo.create_channel(&input).await {
                    Ok(_) => imported += 1,
                    Err(e) => errors.push(format!("导入渠道 '{}' 失败: {}", p.name, e)),
                }
            }
        }
    }

    Ok(ImportResult { imported, skipped, errors })
}

/// Import channels from a waliapi export JSON file content
#[tauri::command]
pub async fn import_waliapi_export(
    content: String,
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<ImportResult, String> {
    let export: WaliapiExport =
        serde_json::from_str(&content).map_err(|e| format!("解析 waliapi 导出文件失败: {}", e))?;

    let repo = Repository::new(state.db.pool.clone());
    let existing = repo.get_all_channels().await.map_err(|e| e.to_string())?;
    let existing_names: std::collections::HashSet<String> =
        existing.iter().map(|c| c.name.clone()).collect();

    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();

    for ch in export.channels {
        if existing_names.contains(&ch.name) {
            skipped += 1;
            continue;
        }

        let input = CreateChannelInput {
            name: ch.name,
            channel_type: ch.r#type,
            base_url: ch.base_url,
            api_key: ch.api_key,
            models: ch.models,
            priority: Some(ch.priority),
            weight: Some(ch.weight),
            config: Some(ch.config),
            model_mapping: Some(ch.model_mapping),
        };

        match repo.create_channel(&input).await {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("导入渠道失败: {}", e)),
        }
    }

    Ok(ImportResult { imported, skipped, errors })
}

/// Scan local AI CLI tool configs (Claude Code, Codex, Cursor, etc.)
#[tauri::command]
pub async fn scan_local_ai_configs() -> Result<ScanResult, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    let mut sources: Vec<ScannedSource> = Vec::new();

    // 1. Claude Code: ~/.claude/settings.json
    let claude_settings = home.join(".claude").join("settings.json");
    if claude_settings.exists() {
        match std::fs::read_to_string(&claude_settings) {
            Ok(content) => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(env) = json.get("env").and_then(|v| v.as_object()) {
                        let base_url = env
                            .get("ANTHROPIC_BASE_URL")
                            .and_then(|v| v.as_str())
                            .unwrap_or("https://api.anthropic.com");
                        let api_key = env
                            .get("ANTHROPIC_AUTH_TOKEN")
                            .or_else(|| env.get("ANTHROPIC_API_KEY"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let model = env
                            .get("ANTHROPIC_MODEL")
                            .and_then(|v| v.as_str())
                            .unwrap_or("claude-sonnet-4-20250514");

                        if !api_key.is_empty() {
                            sources.push(ScannedSource {
                                source: "claude-code".to_string(),
                                name: "Claude Code".to_string(),
                                base_url: base_url.to_string(),
                                api_key: api_key.to_string(),
                                models: vec![model.to_string()],
                                api_format: "anthropic".to_string(),
                                raw: json,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to read Claude Code settings: {}", e);
            }
        }
    }

    // 2. Codex CLI: ~/.codex/config.toml or ~/.codex/config.json
    let codex_dir = home.join(".codex");
    let codex_json = codex_dir.join("config.json");
    let codex_toml = codex_dir.join("config.toml");

    if codex_json.exists() {
        if let Ok(content) = std::fs::read_to_string(&codex_json) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let base_url = json
                    .get("base_url")
                    .or_else(|| json.get("baseUrl"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.openai.com/v1");
                let api_key = json
                    .get("api_key")
                    .or_else(|| json.get("apiKey"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let model = json
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("gpt-4o");

                if !api_key.is_empty() {
                    sources.push(ScannedSource {
                        source: "codex".to_string(),
                        name: "Codex CLI".to_string(),
                        base_url: base_url.to_string(),
                        api_key: api_key.to_string(),
                        models: vec![model.to_string()],
                        api_format: "openai".to_string(),
                        raw: json,
                    });
                }
            }
        }
    } else if codex_toml.exists() {
        if let Ok(content) = std::fs::read_to_string(&codex_toml) {
            // Simple TOML parsing for known fields
            let mut base_url = String::new();
            let mut api_key = String::new();
            let mut model = String::new();

            for line in content.lines() {
                let line = line.trim();
                if let Some(val) = line.strip_prefix("base_url") {
                    base_url = val.trim_start_matches('=').trim().trim_matches('"').to_string();
                } else if let Some(val) = line.strip_prefix("api_key") {
                    api_key = val.trim_start_matches('=').trim().trim_matches('"').to_string();
                } else if let Some(val) = line.strip_prefix("model") {
                    model = val.trim_start_matches('=').trim().trim_matches('"').to_string();
                }
            }

            if !api_key.is_empty() {
                let mut raw_map = serde_json::Map::new();
                raw_map.insert("base_url".to_string(), serde_json::Value::String(base_url.clone()));
                raw_map.insert("api_key".to_string(), serde_json::Value::String(api_key.clone()));
                raw_map.insert("model".to_string(), serde_json::Value::String(model.clone()));

                sources.push(ScannedSource {
                    source: "codex".to_string(),
                    name: "Codex CLI".to_string(),
                    base_url: if base_url.is_empty() {
                        "https://api.openai.com/v1".to_string()
                    } else {
                        base_url
                    },
                    api_key,
                    models: if model.is_empty() {
                        vec!["gpt-4o".to_string()]
                    } else {
                        vec![model]
                    },
                    api_format: "openai".to_string(),
                    raw: serde_json::Value::Object(raw_map),
                });
            }
        }
    }

    // 3. Cursor: ~/.cursor/config or ~/Library/Application Support/Cursor/User/settings.json
    let cursor_settings = home
        .join("Library")
        .join("Application Support")
        .join("Cursor")
        .join("User")
        .join("settings.json");
    if cursor_settings.exists() {
        if let Ok(content) = std::fs::read_to_string(&cursor_settings) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                // Cursor may store API keys in various locations
                let base_url = json
                    .pointer("/cursorai.baseUrl")
                    .and_then(|v| v.as_str());
                let api_key = json
                    .pointer("/cursorai.apiKey")
                    .and_then(|v| v.as_str());

                if let (Some(base_url), Some(api_key)) = (base_url, api_key) {
                    if !api_key.is_empty() {
                        sources.push(ScannedSource {
                            source: "cursor".to_string(),
                            name: "Cursor".to_string(),
                            base_url: base_url.to_string(),
                            api_key: api_key.to_string(),
                            models: vec![],
                            api_format: "openai".to_string(),
                            raw: json,
                        });
                    }
                }
            }
        }
    }

    // 4. OpenAI CLI: ~/.openai/config.json (if exists)
    let openai_config = home.join(".openai").join("config.json");
    if openai_config.exists() {
        if let Ok(content) = std::fs::read_to_string(&openai_config) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let base_url = json
                    .get("base_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("https://api.openai.com/v1");
                let api_key = json
                    .get("api_key")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let model = json
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("gpt-4o");

                if !api_key.is_empty() {
                    sources.push(ScannedSource {
                        source: "openai-cli".to_string(),
                        name: "OpenAI CLI".to_string(),
                        base_url: base_url.to_string(),
                        api_key: api_key.to_string(),
                        models: vec![model.to_string()],
                        api_format: "openai".to_string(),
                        raw: json,
                    });
                }
            }
        }
    }

    Ok(ScanResult { sources })
}

/// Import scanned sources into channels
#[tauri::command]
pub async fn import_scanned_sources(
    sources: Vec<ScannedSource>,
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<ImportResult, String> {
    let repo = Repository::new(state.db.pool.clone());
    let existing = repo.get_all_channels().await.map_err(|e| e.to_string())?;
    let existing_names: std::collections::HashSet<String> =
        existing.iter().map(|c| c.name.clone()).collect();

    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();

    for src in sources {
        let name = src.name.clone();
        if existing_names.contains(&name) {
            skipped += 1;
            continue;
        }

        let channel_type = guess_channel_type(&src.base_url, Some(&src.api_format));

        let input = CreateChannelInput {
            name,
            channel_type,
            base_url: src.base_url,
            api_key: src.api_key,
            models: if src.models.is_empty() {
                vec!["auto".to_string()]
            } else {
                src.models
            },
            priority: Some(0),
            weight: Some(1),
            config: None,
            model_mapping: None,
        };

        match repo.create_channel(&input).await {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("导入扫描源失败: {}", e)),
        }
    }

    Ok(ImportResult { imported, skipped, errors })
}

/// Open a file dialog and return the file content (for import)
#[tauri::command]
pub async fn pick_import_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON files", &["json"])
        .pick_file(move |file_path| {
            let result = file_path.and_then(|f| {
                let path = f.into_path().ok()?;
                std::fs::read_to_string(&path).ok()
            });
            let _ = tx.send(result);
        });

    let result = rx.await.map_err(|_| "对话框取消".to_string())?;
    Ok(result)
}

/// Save a file dialog and return whether save was successful (for export)
#[tauri::command]
pub async fn save_export_file(
    app: tauri::AppHandle,
    content: String,
    default_name: String,
) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("JSON files", &["json"])
        .save_file(move |file_path| {
            if let Some(path) = file_path {
                if let Some(p) = path.as_path() {
                    match std::fs::write(p, &content) {
                        Ok(_) => {
                            let _ = tx.send(true);
                        }
                        Err(e) => {
                            tracing::error!("Failed to save export file: {}", e);
                            let _ = tx.send(false);
                        }
                    }
                    return;
                }
            }
            let _ = tx.send(false);
        });

    let result = rx.await.map_err(|_| "对话框取消".to_string())?;
    Ok(result)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

fn guess_channel_type(base_url: &str, api_format: Option<&str>) -> String {
    let url = base_url.to_lowercase();

    // Check by API format first
    if let Some(fmt) = api_format {
        match fmt {
            "anthropic" => return "claude".to_string(),
            "ollama" => return "ollama".to_string(),
            _ => {}
        }
    }

    // Check by URL
    if url.contains("anthropic.com") {
        return "claude".to_string();
    }
    if url.contains("deepseek.com") {
        return "deepseek".to_string();
    }
    if url.contains("generativelanguage.googleapis.com") || url.contains("gemini") {
        return "gemini".to_string();
    }
    if url.contains("dashscope.aliyuncs.com") {
        return "qwen".to_string();
    }
    if url.contains("bigmodel.cn") {
        return "zhipu".to_string();
    }
    if url.contains("moonshot.cn") || url.contains("kimi") {
        return "moonshot".to_string();
    }
    if url.contains("volces.com") {
        return "doubao".to_string();
    }
    if url.contains("localhost:11434") || url.contains("/api/chat") {
        return "ollama".to_string();
    }

    "custom".to_string()
}
