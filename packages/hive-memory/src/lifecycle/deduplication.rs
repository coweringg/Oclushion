use uuid::Uuid;
use crate::{Insight, LifecycleError};
use super::super::db::connection::Database;

pub struct Deduplication;

impl Deduplication {
    pub fn find_duplicates(
        db: &Database,
        insight: &Insight,
        threshold: f32,
    ) -> Result<Vec<(Uuid, f32)>, LifecycleError> {
        let all = db.all_insights();
        let mut duplicates = Vec::new();

        for existing in &all {
            if existing.id == insight.id {
                continue;
            }
            let sim = cosine_similarity(&existing.vector, &insight.vector);
            if sim > threshold {
                duplicates.push((existing.id, sim));
            }
        }

        duplicates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        Ok(duplicates)
    }

    pub fn merge_duplicates(
        db: &Database,
        keep_id: Uuid,
        remove_ids: &[Uuid],
    ) -> Result<Option<Insight>, LifecycleError> {
        let kept = db.get(keep_id);
        let mut kept = match kept {
            Some(k) => k,
            None => return Ok(None),
        };

        for &id in remove_ids {
            if id == keep_id {
                continue;
            }
            if let Some(removed) = db.get(id) {
                for tag in removed.tags {
                    if !kept.tags.contains(&tag) {
                        kept.tags.push(tag);
                    }
                }
                if removed.confidence > kept.confidence {
                    kept.confidence = removed.confidence;
                }
            }
            db.delete(id)
                .map_err(|e| LifecycleError::General(e.to_string()))?;
        }

        db.delete(keep_id)
            .map_err(|e| LifecycleError::General(e.to_string()))?;
        db.insert(kept.clone())
            .map_err(|e| LifecycleError::General(e.to_string()))?;

        Ok(Some(kept))
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}
