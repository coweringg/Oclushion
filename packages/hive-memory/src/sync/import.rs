use crate::{Insight, SyncError};
use super::super::db::connection::Database;
use super::conflict_resolution::{ConflictResolution, ConflictResolver};

pub struct SyncImport;

impl SyncImport {
    pub fn import_insights(
        db: &Database,
        data: &[u8],
        strategy: ConflictResolution,
    ) -> Result<u64, SyncError> {
        let insights: Vec<Insight> =
            serde_json::from_slice(data).map_err(|e| SyncError::General(e.to_string()))?;
        let mut count = 0u64;

        for incoming in insights {
            let existing = db.get(incoming.id);
            match existing {
                Some(existing) => {
                    let resolved = ConflictResolver::resolve(&existing, &incoming, strategy);
                    db.insert(resolved)
                        .map_err(|e| SyncError::General(e.to_string()))?;
                }
                None => {
                    db.insert(incoming)
                        .map_err(|e| SyncError::General(e.to_string()))?;
                }
            }
            count += 1;
        }

        Ok(count)
    }

    pub fn resolve_conflict(existing: &Insight, incoming: &Insight) -> Insight {
        ConflictResolver::resolve(existing, incoming, ConflictResolution::LastWriteWins)
    }
}
