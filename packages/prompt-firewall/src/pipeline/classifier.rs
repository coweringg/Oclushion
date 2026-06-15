use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::{Severity, ThreatCategory, Verdict};
use crate::pipeline::result::PhaseResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationResult {
    pub probability: f64,
    pub threshold: f64,
    pub verdict: Verdict,
    pub confidence_factors: HashMap<String, f64>,
}

#[derive(Clone)]
pub struct LocalClassifier {
    threshold: f64,
}

impl LocalClassifier {
    pub fn new() -> Self {
        Self { threshold: 0.7 }
    }

    pub fn with_threshold(threshold: f64) -> Self {
        Self { threshold }
    }

    pub fn classify(&self, phases: &[PhaseResult]) -> ClassificationResult {
        let mut confidence_factors = HashMap::new();
        let mut total_weight = 0.0;
        let mut weighted_sum = 0.0;

        for phase in phases {
            let (weight, factor) = match phase.phase_name.as_str() {
                "unicode_normalizer" => {
                    let score = phase.score.min(1.0);
                    (0.1, score)
                }
                "invisible_chars" => {
                    let score = phase.score.min(1.0);
                    (0.2, score)
                }
                "pattern_matcher" => {
                    let score = phase.score.min(1.0);
                    (0.4, score)
                }
                "entropy_analyzer" => {
                    let score = phase.score.min(1.0);
                    (0.15, score)
                }
                _ => (0.0, 0.0),
            };

            if weight > 0.0 {
                total_weight += weight;
                weighted_sum += weight * factor;
                confidence_factors.insert(phase.phase_name.clone(), factor);
            }
        }

        let probability = if total_weight > 0.0 {
            weighted_sum / total_weight
        } else {
            0.0
        };

        let verdict = if probability >= self.threshold {
            Verdict::Suspicious
        } else {
            Verdict::Safe
        };

        ClassificationResult {
            probability,
            threshold: self.threshold,
            verdict,
            confidence_factors,
        }
    }

    pub fn classify_full(
        &self,
        phases: &[PhaseResult],
        invisible_count: usize,
        pattern_scores: &[f64],
        entropy_suspicious: bool,
    ) -> ClassificationResult {
        let mut factors = HashMap::new();
        let mut probability = 0.0;

        let pattern_max = pattern_scores.iter().cloned().fold(0.0_f64, f64::max);
        let invisible_score = (invisible_count as f64 * 0.15).min(1.0);
        let entropy_score = if entropy_suspicious { 0.5 } else { 0.0 };

        probability += pattern_max * 0.5;
        probability += invisible_score * 0.25;
        probability += entropy_score * 0.15;

        let phase_score = if !phases.is_empty() {
            let sum: f64 = phases.iter().map(|p| p.score).sum();
            sum / phases.len() as f64
        } else {
            0.0
        };
        probability += phase_score * 0.1;

        factors.insert("pattern_max".to_string(), pattern_max);
        factors.insert("invisible_score".to_string(), invisible_score);
        factors.insert("entropy_score".to_string(), entropy_score);
        factors.insert("phase_score".to_string(), phase_score);

        let verdict = if probability >= self.threshold {
            Verdict::Suspicious
        } else {
            Verdict::Safe
        };

        ClassificationResult {
            probability: probability.min(1.0),
            threshold: self.threshold,
            verdict,
            confidence_factors: factors,
        }
    }

    pub fn classify_verdict(
        &self,
        probability: f64,
    ) -> (Verdict, Severity, ThreatCategory) {
        if probability >= 0.9 {
            (Verdict::Quarantined, Severity::Critical, ThreatCategory::Injection)
        } else if probability >= self.threshold {
            (Verdict::Suspicious, Severity::High, ThreatCategory::Injection)
        } else if probability >= 0.4 {
            (Verdict::Suspicious, Severity::Low, ThreatCategory::Benign)
        } else {
            (Verdict::Safe, Severity::None, ThreatCategory::Benign)
        }
    }
}
