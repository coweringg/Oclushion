use uuid::Uuid;
use crate::{Insight, LifecycleError};
use super::super::db::connection::Database;
use super::super::embedding::onnx_runtime::OnnxRuntime;
use super::ttl::TtlManager;

pub struct IngestionPipeline;

impl IngestionPipeline {
    pub fn ingest(
        db: &Database,
        embedding: &OnnxRuntime,
        mut insight: Insight,
    ) -> Result<(), LifecycleError> {
        if insight.vector.is_empty() {
            let vec = embedding
                .embed(&insight.text)
                .map_err(|e| LifecycleError::General(e.to_string()))?;
            insight.vector = vec;
        }

        if insight.id == Uuid::nil() {
            insight.id = Uuid::now_v7();
        }

        if insight.expires_at <= insight.created_at {
            let ttl = TtlManager::get_ttl(insight.confidence);
            let expires_at = chrono::Utc::now()
                + chrono::Duration::from_std(ttl)
                    .unwrap_or_else(|_| chrono::Duration::days(365));
            insight.expires_at = expires_at;
        }

        db.insert(insight)
            .map_err(|e| LifecycleError::General(e.to_string()))
    }

    pub fn auto_deduplicate(
        db: &Database,
        embedding: &OnnxRuntime,
        insight: &Insight,
        threshold: f32,
    ) -> Result<Option<Insight>, LifecycleError> {
        let all = db.all_insights();
        let insight_vec = if insight.vector.is_empty() {
            embedding
                .embed(&insight.text)
                .map_err(|e| LifecycleError::General(e.to_string()))?
        } else {
            insight.vector.clone()
        };

        for existing in &all {
            let existing_vec = if existing.vector.is_empty() {
                embedding
                    .embed(&existing.text)
                    .map_err(|e| LifecycleError::General(e.to_string()))?
            } else {
                existing.vector.clone()
            };

            let sim = cosine_similarity(&existing_vec, &insight_vec);
            if sim > threshold {
                return Ok(Some(existing.clone()));
            }
        }
        Ok(None)
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
