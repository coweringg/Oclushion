use crate::pipeline::classifier::LocalClassifier;
use crate::pipeline::entropy_analyzer::EntropyAnalyzer;
use crate::pipeline::invisible_chars::InvisibleCharDetector;
use crate::pipeline::pattern_matcher::{PatternMatch, PatternMatcher};
use crate::pipeline::result::{AnalysisResult, PhaseMatch, PhaseResult};
use crate::pipeline::unicode_normalizer::UnicodeNormalizer;
use crate::{Severity, ThreatCategory, Verdict};

#[derive(Clone)]
pub struct Orchestrator {
    normalizer: UnicodeNormalizer,
    invisible_detector: InvisibleCharDetector,
    pattern_matcher: PatternMatcher,
    entropy_analyzer: EntropyAnalyzer,
    classifier: LocalClassifier,
}

impl Orchestrator {
    pub fn new(pattern_matcher: PatternMatcher) -> Self {
        Self {
            normalizer: UnicodeNormalizer::new(),
            invisible_detector: InvisibleCharDetector::new(),
            pattern_matcher,
            entropy_analyzer: EntropyAnalyzer::new(),
            classifier: LocalClassifier::new(),
        }
    }

    pub fn with_classifier_threshold(mut self, threshold: f64) -> Self {
        self.classifier = LocalClassifier::with_threshold(threshold);
        self
    }

    pub fn analyze(&self, text: &str, file_path: &str) -> AnalysisResult {
        let mut phases = Vec::new();
        let mut overall_score = 0.0;
        let mut highest_severity = Severity::None;
        let mut category = ThreatCategory::Benign;

        let normalized = self.normalizer.normalize(text);
        let norm_phase = {
            let score = if normalized.homoglyph_count > 5 {
                0.8
            } else if normalized.homoglyph_count > 0 {
                0.4
            } else {
                0.0
            };
            let matches: Vec<PhaseMatch> = if normalized.total_normalizations > 0 {
                vec![PhaseMatch::Normalization {
                    original: normalized.original[..normalized.original.len().min(100)].to_string(),
                    normalized: normalized.normalized[..normalized.normalized.len().min(100)].to_string(),
                    count: normalized.total_normalizations,
                }]
            } else {
                Vec::new()
            };
            PhaseResult {
                phase_name: "unicode_normalizer".to_string(),
                score,
                details: format!(
                    "Homoglyphs: {}, total normalizations: {}",
                    normalized.homoglyph_count, normalized.total_normalizations
                ),
                matches,
            }
        };
        if norm_phase.score > 0.0 {
            overall_score += norm_phase.score * 0.1;
            highest_severity = Severity::Medium;
            category = ThreatCategory::UnicodeAttack;
        }
        phases.push(norm_phase);

        let invisible_matches = self.invisible_detector.scan(&normalized.normalized);
        let invisible_phase = {
            let score = self.invisible_detector.severity_score(&invisible_matches);
            let matches: Vec<PhaseMatch> = invisible_matches
                .iter()
                .map(|m| PhaseMatch::InvisibleChar(m.clone()))
                .collect();
            PhaseResult {
                phase_name: "invisible_chars".to_string(),
                score,
                details: format!("{} invisible character(s) found", invisible_matches.len()),
                matches,
            }
        };
        if invisible_phase.score > 0.0 {
            overall_score += invisible_phase.score * 0.2;
            if invisible_phase.score >= 0.8 {
                highest_severity = Severity::High;
            } else if invisible_phase.score >= 0.5 {
                highest_severity = Severity::Medium;
            }
            category = ThreatCategory::UnicodeAttack;
        }
        phases.push(invisible_phase);

        let pattern_matches = self.pattern_matcher.scan(&normalized.normalized);
        let pattern_phase = {
            let score = self.pattern_matcher.aggregate_score(&pattern_matches);
            let matches: Vec<PhaseMatch> = pattern_matches
                .iter()
                .map(|m| PhaseMatch::Pattern(m.clone()))
                .collect();
            PhaseResult {
                phase_name: "pattern_matcher".to_string(),
                score,
                details: format!("{} pattern match(es) found", pattern_matches.len()),
                matches,
            }
        };
        if pattern_phase.score > 0.0 {
            overall_score += pattern_phase.score * 0.4;
            let max_sev = self.pattern_matcher.max_severity(&pattern_matches);
            if max_sev >= 0.9 {
                highest_severity = Severity::Critical;
            } else if max_sev >= 0.75 {
                highest_severity = Severity::High;
            } else if max_sev >= 0.5 {
                highest_severity = Severity::Medium;
            }
            category = categorize_patterns(&pattern_matches);
        }
        phases.push(pattern_phase);

        let strings_to_check: Vec<&str> = normalized
            .normalized
            .lines()
            .filter(|l| l.len() > 20 && l.chars().any(|c| !c.is_ascii_alphanumeric()))
            .collect();

        let entropy_results = self.entropy_analyzer.analyze_strings(&strings_to_check);
        let mut any_entropy_suspicious = false;
        let mut entropy_details = String::new();

        for er in &entropy_results {
            if er.is_suspicious {
                any_entropy_suspicious = true;
                entropy_details.push_str(&format!(
                    "High entropy ({:.2}) at len {}; ",
                    er.entropy,
                    er.original.len()
                ));
                if !er.decoded_texts.is_empty() {
                    entropy_details.push_str("Decoded payload; ");
                    category = ThreatCategory::EncodedPayload;
                }
            }
        }

        let entropy_phase = {
            let score = if any_entropy_suspicious {
                let max_entropy = entropy_results
                    .iter()
                    .map(|e| e.entropy)
                    .fold(0.0_f64, f64::max);
                ((max_entropy - 4.5) / 3.0).min(1.0)
            } else {
                0.0
            };
            let matches: Vec<PhaseMatch> = entropy_results
                .iter()
                .map(|e| PhaseMatch::Entropy(e.clone()))
                .collect();
            PhaseResult {
                phase_name: "entropy_analyzer".to_string(),
                score,
                details: if entropy_details.is_empty() {
                    "No high-entropy strings found".to_string()
                } else {
                    entropy_details
                },
                matches,
            }
        };
        if entropy_phase.score > 0.0 {
            overall_score += entropy_phase.score * 0.15;
            if highest_severity < Severity::Medium {
                highest_severity = Severity::Medium;
            }
        }
        phases.push(entropy_phase);

        let classification = self.classifier.classify(&phases);
        let (verdict, sev, cat) = self.classifier.classify_verdict(classification.probability);
        let class_score = classification.probability;

        let class_phase = PhaseResult {
            phase_name: "classifier".to_string(),
            score: class_score,
            details: format!(
                "Probability: {:.3}, threshold: {}, factors: {:?}",
                class_score,
                classification.threshold,
                classification.confidence_factors
            ),
            matches: vec![PhaseMatch::Classification(classification)],
        };
        phases.push(class_phase);

        if class_score > 0.0 {
            overall_score += class_score * 0.15;
        }

        let final_severity = if sev > highest_severity { sev } else { highest_severity };
        let final_category = if class_score >= 0.7 {
            cat
        } else if category != ThreatCategory::Benign {
            category
        } else {
            ThreatCategory::Benign
        };

        let details = if verdict == Verdict::Safe {
            "No threats detected".to_string()
        } else {
            format!(
                "Threat detected: {:?} with probability {:.2}",
                final_category, class_score
            )
        };

        match verdict {
            Verdict::Safe => AnalysisResult::safe(file_path),
            Verdict::Suspicious => AnalysisResult::suspicious(
                file_path,
                final_severity,
                phases,
                overall_score,
                final_category,
                details,
            ),
            Verdict::Quarantined => AnalysisResult::quarantined(
                file_path,
                final_severity,
                phases,
                overall_score,
                final_category,
                details,
            ),
        }
    }
}

fn categorize_patterns(matches: &[PatternMatch]) -> ThreatCategory {
    let mut has_injection = false;
    let mut has_jailbreak = false;
    let mut has_exfil = false;

    for m in matches {
        match m.category.as_str() {
            "injection" => has_injection = true,
            "jailbreak" => has_jailbreak = true,
            "exfil" => has_exfil = true,
            _ => {}
        }
    }

    if has_exfil {
        ThreatCategory::DataExfil
    } else if has_jailbreak {
        ThreatCategory::Jailbreak
    } else if has_injection {
        ThreatCategory::Injection
    } else {
        ThreatCategory::Benign
    }
}
