use crate::{DbError};
use super::connection::Database;

pub struct Compaction;

impl Compaction {
    pub fn compact(db: &Database) -> Result<u64, DbError> {
        let insights = db.all_insights();
        let now = chrono::Utc::now();
        let mut removed = 0u64;

        for insight in &insights {
            if insight.expires_at < now {
                db.delete(insight.id)?;
                removed += 1;
            }
        }

        let remaining = db.all_insights();
        for i in 0..remaining.len() {
            for j in (i + 1)..remaining.len() {
                let sim = cosine_similarity(&remaining[i].vector, &remaining[j].vector);
                if sim > 0.95 {
                    db.delete(remaining[j].id)?;
                    removed += 1;
                }
            }
        }

        Ok(removed)
    }

    pub fn needs_compaction(db: &Database) -> bool {
        let count = db.insight_count();
        count > 1000
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
