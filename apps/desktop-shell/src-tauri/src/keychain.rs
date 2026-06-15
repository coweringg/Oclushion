use keyring::Entry;

const SERVICE_NAME: &str = "oclushion";
const MAX_KEY_LENGTH: usize = 2048;

const ALLOWED_PROVIDERS: &[&str] = &["openai", "anthropic", "ollama"];

fn validate_provider(provider: &str) -> Result<(), String> {
    if provider.is_empty() {
        return Err("provider cannot be empty".to_string());
    }
    if !ALLOWED_PROVIDERS.contains(&provider) {
        return Err(format!(
            "invalid provider '{}'; allowed: {}",
            provider,
            ALLOWED_PROVIDERS.join(", ")
        ));
    }
    Ok(())
}

fn entry_for_provider(provider: &str) -> Result<Entry, String> {
    validate_provider(provider)?;
    Entry::new(SERVICE_NAME, &format!("api-key-{}", provider)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_api_key(provider: String, value: String) -> Result<(), String> {
    let entry = entry_for_provider(&provider)?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        entry.delete_credential().map_err(|e| e.to_string())?;
    } else {
        if trimmed.len() > MAX_KEY_LENGTH {
            return Err(format!("key exceeds maximum length of {} characters", MAX_KEY_LENGTH));
        }
        entry
            .set_password(trimmed)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_api_key(provider: String) -> Result<Option<String>, String> {
    let entry = entry_for_provider(&provider)?;
    match entry.get_password() {
        Ok(v) => {
            let trimmed = v.trim().to_string();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(trimmed))
            }
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    let entry = entry_for_provider(&provider)?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_all_keys() -> Result<std::collections::HashMap<String, Option<String>>, String> {
    let mut result = std::collections::HashMap::new();
    for provider in ALLOWED_PROVIDERS {
        let value = load_api_key(provider.to_string())?;
        result.insert(provider.to_string(), value);
    }
    Ok(result)
}
