use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Experiment {
    pub id: String,
    pub name: String,
    pub variants: Vec<String>,
    pub task_count: usize,
    pub min_samples: usize,
    pub is_active: bool,
    pub assignments: HashMap<String, String>,
    pub results: Option<ExperimentResults>,
}

impl Experiment {
    pub fn new(name: &str, variant_a: &str, variant_b: &str) -> Self {
        Experiment {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            variants: vec![variant_a.to_string(), variant_b.to_string()],
            task_count: 0,
            min_samples: 30,
            is_active: true,
            assignments: HashMap::new(),
            results: None,
        }
    }

    pub fn variant_a(&self) -> &str {
        &self.variants[0]
    }

    pub fn variant_b(&self) -> &str {
        &self.variants[1]
    }

    pub fn variant_scores(&self) -> (Vec<f64>, Vec<f64>) {
        if let Some(ref results) = self.results {
            return (results.variant_a_scores.clone(), results.variant_b_scores.clone());
        }
        (Vec::new(), Vec::new())
    }

    pub fn is_complete(&self) -> bool {
        self.task_count >= self.min_samples && self.results.is_some()
    }

    pub fn add_score(&mut self, task_id: &str, variant: &str, score: f64) {
        if !self.is_active {
            return;
        }
        self.assignments.insert(task_id.to_string(), variant.to_string());
        self.task_count += 1;
        let var_a = self.variant_a().to_string();
        let var_b = self.variant_b().to_string();
        if let Some(ref mut results) = self.results {
            if variant == var_a {
                results.variant_a_scores.push(score);
            } else if variant == var_b {
                results.variant_b_scores.push(score);
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperimentResults {
    pub variant_a_scores: Vec<f64>,
    pub variant_b_scores: Vec<f64>,
    pub u_statistic: f64,
    pub p_value: f64,
    pub confidence_interval: (f64, f64),
    pub effect_size: f64,
    pub winner: Option<String>,
}
