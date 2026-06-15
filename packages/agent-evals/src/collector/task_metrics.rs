use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskMetrics {
    pub first_pass_compilation: bool,
    pub bug_detection_precision: f64,
    pub false_positive_rate: f64,
    pub plan_success_rate: f64,
    pub time_to_completion_s: f64,
    pub token_efficiency: f64,
    pub cost_per_task: f64,
    pub user_acceptance_rate: f64,
    pub visual_qa_pass_rate: f64,
    pub savings_accuracy: f64,
}

impl TaskMetrics {
    pub fn new() -> Self {
        TaskMetrics {
            first_pass_compilation: false,
            bug_detection_precision: 0.0,
            false_positive_rate: 0.0,
            plan_success_rate: 0.0,
            time_to_completion_s: 0.0,
            token_efficiency: 0.0,
            cost_per_task: 0.0,
            user_acceptance_rate: 0.0,
            visual_qa_pass_rate: 0.0,
            savings_accuracy: 0.0,
        }
    }

    pub fn quality_score(&self) -> f64 {
        let mut score = 0.0;
        let mut count = 0.0;

        if self.first_pass_compilation {
            score += 1.0;
        }
        count += 1.0;

        score += self.bug_detection_precision.max(0.0).min(1.0);
        count += 1.0;

        score += (1.0 - self.false_positive_rate).max(0.0).min(1.0);
        count += 1.0;

        score += self.plan_success_rate.max(0.0).min(1.0);
        count += 1.0;

        score += self.user_acceptance_rate.max(0.0).min(1.0);
        count += 1.0;

        score += self.visual_qa_pass_rate.max(0.0).min(1.0);
        count += 1.0;

        score += self.savings_accuracy.max(0.0).min(1.0);
        count += 1.0;

        if count > 0.0 {
            score / count
        } else {
            0.0
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if !(0.0..=1.0).contains(&self.bug_detection_precision) {
            return Err("bug_detection_precision must be in [0, 1]".into());
        }
        if !(0.0..=1.0).contains(&self.false_positive_rate) {
            return Err("false_positive_rate must be in [0, 1]".into());
        }
        if !(0.0..=1.0).contains(&self.plan_success_rate) {
            return Err("plan_success_rate must be in [0, 1]".into());
        }
        if !(0.0..=1.0).contains(&self.user_acceptance_rate) {
            return Err("user_acceptance_rate must be in [0, 1]".into());
        }
        if !(0.0..=1.0).contains(&self.visual_qa_pass_rate) {
            return Err("visual_qa_pass_rate must be in [0, 1]".into());
        }
        if !(0.0..=1.0).contains(&self.savings_accuracy) {
            return Err("savings_accuracy must be in [0, 1]".into());
        }
        if self.time_to_completion_s < 0.0 {
            return Err("time_to_completion_s must be non-negative".into());
        }
        if self.cost_per_task < 0.0 {
            return Err("cost_per_task must be non-negative".into());
        }
        if self.token_efficiency < 0.0 {
            return Err("token_efficiency must be non-negative".into());
        }
        Ok(())
    }
}

impl Default for TaskMetrics {
    fn default() -> Self {
        Self::new()
    }
}
