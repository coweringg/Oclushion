use crate::LifecycleError;
use super::super::db::connection::Database;

pub struct Pruning;

impl Pruning {
    pub fn prune_expired(db: &Database) -> Result<u64, LifecycleError> {
        let insights = db.all_insights();
        let now = chrono::Utc::now();
        let mut count = 0u64;

        for insight in &insights {
            if insight.expires_at <= now {
                db.delete(insight.id)
                    .map_err(|e| LifecycleError::General(e.to_string()))?;
                count += 1;
            }
        }
        Ok(count)
    }

    pub fn prune_low_confidence(db: &Database, threshold: f32) -> Result<u64, LifecycleError> {
        let insights = db.all_insights();
        let mut count = 0u64;

        for insight in &insights {
            if insight.confidence < threshold {
                db.delete(insight.id)
                    .map_err(|e| LifecycleError::General(e.to_string()))?;
                count += 1;
            }
        }
        Ok(count)
    }
}
