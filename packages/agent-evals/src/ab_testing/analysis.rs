use crate::ab_testing::experiment::{Experiment, ExperimentResults};
use crate::engine::statistical_tests::StatisticalTests;

pub struct Analysis;

impl Analysis {
    pub fn run(experiment: &mut Experiment) -> Option<ExperimentResults> {
        let (scores_a, scores_b) = experiment.variant_scores();

        if scores_a.len() < StatisticalTests::MIN_SAMPLES
            || scores_b.len() < StatisticalTests::MIN_SAMPLES
        {
            return None;
        }

        let test_result = StatisticalTests::mann_whitney_u(&scores_a, &scores_b)?;

        let mean_a = test_result.mean_a;
        let mean_b = test_result.mean_b;
        let winner = if test_result.significant_at_95 {
            Some(if mean_a > mean_b {
                experiment.variant_a().to_string()
            } else {
                experiment.variant_b().to_string()
            })
        } else {
            None
        };

        let results = ExperimentResults {
            variant_a_scores: scores_a,
            variant_b_scores: scores_b,
            u_statistic: test_result.u_statistic,
            p_value: test_result.p_value,
            confidence_interval: test_result.confidence_interval,
            effect_size: test_result.effect_size,
            winner,
        };

        experiment.results = Some(results.clone());
        Some(results)
    }

    pub fn has_min_samples(experiment: &Experiment) -> bool {
        let (scores_a, scores_b) = experiment.variant_scores();
        scores_a.len() >= StatisticalTests::MIN_SAMPLES
            && scores_b.len() >= StatisticalTests::MIN_SAMPLES
    }

    pub fn sample_sizes(experiment: &Experiment) -> (usize, usize) {
        let (scores_a, scores_b) = experiment.variant_scores();
        (scores_a.len(), scores_b.len())
    }
}
