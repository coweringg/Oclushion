use crate::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct CredentialManager {
    store: Arc<RwLock<HashMap<String, HashMap<String, String>>>>,
}

impl CredentialManager {
    pub fn new() -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn store_credential(&self, server: &str, key: &str, value: &str) -> Result<()> {
        let mut guard = self.store.write().await;
        guard
            .entry(server.to_string())
            .or_default()
            .insert(key.to_string(), value.to_string());
        Ok(())
    }

    pub async fn get_credential(&self, server: &str, key: &str) -> Result<Option<String>> {
        let guard = self.store.read().await;
        Ok(guard
            .get(server)
            .and_then(|creds| creds.get(key))
            .cloned())
    }

    pub async fn delete_credential(&self, server: &str, key: &str) -> Result<()> {
        let mut guard = self.store.write().await;
        if let Some(creds) = guard.get_mut(server) {
            creds.remove(key);
        }
        Ok(())
    }

    pub async fn list_credential_keys(&self, server: &str) -> Vec<String> {
        let guard = self.store.read().await;
        guard
            .get(server)
            .map(|creds| creds.keys().cloned().collect())
            .unwrap_or_default()
    }
}
