pub struct TokenEfficiency;

impl TokenEfficiency {
    pub fn compute(quality_score: f64, tokens_consumed: f64) -> f64 {
        if tokens_consumed <= 0.0 {
            return 0.0;
        }
        (quality_score / tokens_consumed).max(0.0)
    }

    pub fn score_per_1k_tokens(quality_score: f64, tokens_consumed: f64) -> f64 {
        Self::compute(quality_score, tokens_consumed) * 1000.0
    }
}
