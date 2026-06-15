use crate::Result;
use chrono::{DateTime, Utc};
use chrono::Duration as ChronoDuration;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ApprovalRequest {
    pub id: Uuid,
    pub server: String,
    pub tool: String,
    pub args: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct ApprovalManager {
    pending: Arc<RwLock<HashMap<Uuid, ApprovalRequest>>>,
    session_approvals: Arc<RwLock<HashMap<(String, String), bool>>>,
}

impl ApprovalManager {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(RwLock::new(HashMap::new())),
            session_approvals: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn request_approval(
        &self,
        server: &str,
        tool: &str,
        args: &serde_json::Value,
    ) -> Result<bool> {
        {
            let session = self.session_approvals.read().await;
            if session.contains_key(&(server.to_string(), tool.to_string())) {
                return Ok(true);
            }
        }

        let now = Utc::now();
        let request = ApprovalRequest {
            id: Uuid::new_v4(),
            server: server.to_string(),
            tool: tool.to_string(),
            args: args.clone(),
            created_at: now,
            expires_at: now + ChronoDuration::try_minutes(5).unwrap_or_default(),
        };

        let id = request.id;
        let mut pending = self.pending.write().await;
        pending.insert(id, request);

        Ok(false)
    }

    pub async fn approve(&self, request_id: Uuid) -> Result<()> {
        let mut pending = self.pending.write().await;
        if let Some(req) = pending.remove(&request_id) {
            let mut session = self.session_approvals.write().await;
            session.insert((req.server, req.tool), true);
        }
        Ok(())
    }

    pub async fn reject(&self, request_id: Uuid, _reason: &str) -> Result<()> {
        let mut pending = self.pending.write().await;
        pending.remove(&request_id);
        Ok(())
    }

    pub async fn session_approve(&self, server: &str, tool: &str) {
        let mut session = self.session_approvals.write().await;
        session.insert((server.to_string(), tool.to_string()), true);
    }

    pub async fn pending_approvals(&self) -> Vec<ApprovalRequest> {
        let mut pending = self.pending.write().await;
        let now = Utc::now();
        pending.retain(|_, req| req.expires_at > now);
        pending.values().cloned().collect()
    }
}
