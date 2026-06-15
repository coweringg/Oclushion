use std::collections::{HashMap, HashSet};
use crate::{SearchError, SearchResult};
use super::super::db::connection::Database;
use super::super::embedding::tokenizer::Tokenizer;
use super::super::embedding::onnx_runtime::compute_simulated_embedding;

pub struct HybridSearch;

impl HybridSearch {
    pub fn search(
        db: &Database,
        query_text: &str,
        k: usize,
    ) -> Result<Vec<SearchResult>, SearchError> {
        let insights = db.all_insights();
        if insights.is_empty() {
            return Ok(Vec::new());
        }

        let mut tokenizer = Tokenizer::new();
        let query_tokens = tokenizer.tokenize(query_text);

        if query_tokens.is_empty() {
            return Err(SearchError::General(
                "Empty query after tokenization".to_string(),
            ));
        }

        let doc_count = insights.len() as f32;
        let mut df: HashMap<u32, f32> = HashMap::new();
        let mut doc_tokens: Vec<Vec<u32>> = Vec::with_capacity(insights.len());

        for insight in &insights {
            let tokens = tokenizer.tokenize(&insight.text);
            let unique: HashSet<u32> = tokens.iter().copied().collect();
            for token in unique {
                *df.entry(token).or_insert(0.0) += 1.0;
            }
            doc_tokens.push(tokens);
        }

        let k1 = 1.2f32;
        let b = 0.75f32;
        let avg_doc_len = doc_tokens.iter().map(|t| t.len() as f32).sum::<f32>() / doc_count;

        let mut text_scores: Vec<(usize, f32)> = Vec::with_capacity(insights.len());
        for (idx, tokens) in doc_tokens.iter().enumerate() {
            let doc_len = tokens.len() as f32;
            let mut score = 0.0f32;
            for qt in &query_tokens {
                let tf = tokens.iter().filter(|t| *t == qt).count() as f32;
                if tf == 0.0 {
                    continue;
                }
                let idf = ((doc_count - df.get(qt).copied().unwrap_or(0.0) + 0.5)
                    / (df.get(qt).copied().unwrap_or(0.0) + 0.5))
                    .ln()
                    .max(0.0)
                    + 1.0;
                let numerator = tf * (k1 + 1.0);
                let denominator = tf + k1 * (1.0 - b + b * doc_len / avg_doc_len);
                score += idf * numerator / denominator;
            }
            text_scores.push((idx, score));
        }

        text_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let query_vec = compute_simulated_embedding(query_text);

        let mut vector_scores: Vec<(usize, f32)> = insights
            .iter()
            .enumerate()
            .map(|(idx, insight)| {
                let score =
                    super::vector_search::cosine_similarity(&query_vec, &insight.vector);
                (idx, score)
            })
            .collect();

        vector_scores
            .sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let k_rrf = 60.0f32;
        let mut rrf_scores: HashMap<usize, f32> = HashMap::new();

        for (rank, (idx, _)) in text_scores.iter().enumerate() {
            *rrf_scores.entry(*idx).or_insert(0.0) += 1.0 / (k_rrf + rank as f32);
        }

        for (rank, (idx, _)) in vector_scores.iter().enumerate() {
            *rrf_scores.entry(*idx).or_insert(0.0) += 1.0 / (k_rrf + rank as f32);
        }

        let mut ranked: Vec<(usize, f32)> = rrf_scores.into_iter().collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let results: Vec<SearchResult> = ranked
            .into_iter()
            .take(k)
            .map(|(idx, score)| SearchResult {
                insight: insights[idx].clone(),
                score,
            })
            .collect();

        Ok(results)
    }
}
