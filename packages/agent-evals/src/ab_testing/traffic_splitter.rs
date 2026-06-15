use rand::Rng;

use crate::ab_testing::experiment::Experiment;

pub struct TrafficSplitter;

impl TrafficSplitter {
    pub fn assign(experiment: &Experiment, task_id: &str) -> String {
        use std::hash::{Hash, Hasher};
        use std::collections::hash_map::DefaultHasher;
        let mut hasher = DefaultHasher::new();
        task_id.hash(&mut hasher);
        experiment.id.hash(&mut hasher);
        let idx = hasher.finish() as usize % 2;
        experiment.variants[idx].clone()
    }

    pub fn assign_random(experiment: &Experiment, _task_id: &str) -> String {
            let mut rng = rand::thread_rng();
        let idx: usize = rng.gen_range(0..2);
        experiment.variants[idx].clone()
    }

    pub fn assignment_counts(experiment: &Experiment) -> (usize, usize) {
        let count_a = experiment
            .assignments
            .values()
            .filter(|v| *v == &experiment.variants[0])
            .count();
        let count_b = experiment
            .assignments
            .values()
            .filter(|v| *v == &experiment.variants[1])
            .count();
        (count_a, count_b)
    }

    pub fn balance_ratio(experiment: &Experiment) -> f64 {
        let (count_a, count_b) = Self::assignment_counts(experiment);
        let total = count_a + count_b;
        if total == 0 {
            return 1.0;
        }
        let ratio = count_a as f64 / total as f64;
        (ratio - 0.5).abs() * 2.0
    }
}
