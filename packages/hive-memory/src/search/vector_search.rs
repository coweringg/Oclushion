use crate::{SearchError, SearchResult};
use super::super::db::connection::Database;

pub struct VectorSearch;

impl VectorSearch {
    pub fn search_by_vector(
        db: &Database,
        query_vec: &[f32],
        k: usize,
    ) -> Result<Vec<SearchResult>, SearchError> {
        if query_vec.is_empty() {
            return Err(SearchError::EmptyQuery);
        }

        let insights = db.all_insights();
        let mut scored: Vec<SearchResult> = insights
            .into_iter()
            .map(|insight| {
                let score = cosine_similarity(query_vec, &insight.vector);
                SearchResult { insight, score }
            })
            .collect();

        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(k);
        Ok(scored)
    }
}

pub(crate) fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}
