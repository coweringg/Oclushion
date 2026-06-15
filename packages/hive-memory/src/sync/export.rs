use chrono::{DateTime, Utc};
use crate::{Insight, SyncError};
use super::super::db::connection::Database;

pub struct SyncExport;

impl SyncExport {
    pub fn export_new_insights(
        db: &Database,
        since: DateTime<Utc>,
    ) -> Result<Vec<u8>, SyncError> {
        let insights: Vec<Insight> = db
            .all_insights()
            .into_iter()
            .filter(|i| i.created_at > since)
            .collect();
        serde_json::to_vec(&insights).map_err(|e| SyncError::General(e.to_string()))
    }

    pub fn export_all(db: &Database) -> Result<Vec<u8>, SyncError> {
        let insights = db.all_insights();
        serde_json::to_vec(&insights).map_err(|e| SyncError::General(e.to_string()))
    }
}
