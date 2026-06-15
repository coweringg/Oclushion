pub struct StatisticalTests;

impl StatisticalTests {
    pub const MIN_SAMPLES: usize = 30;

    pub fn has_sufficient_samples(a: &[f64], b: &[f64]) -> bool {
        a.len() >= Self::MIN_SAMPLES && b.len() >= Self::MIN_SAMPLES
    }

    pub fn mann_whitney_u(a: &[f64], b: &[f64]) -> Option<MannWhitneyResult> {
        if a.len() < 2 || b.len() < 2 {
            return None;
        }

        let n1 = a.len();
        let n2 = b.len();

        let mut all_values: Vec<(f64, u8)> = Vec::with_capacity(n1 + n2);
        for &v in a {
            all_values.push((v, 0));
        }
        for &v in b {
            all_values.push((v, 1));
        }

        all_values.sort_by(|x, y| x.0.partial_cmp(&y.0).unwrap_or(std::cmp::Ordering::Equal));

        let mut ranks = vec![0.0; n1 + n2];
        let mut i = 0;
        while i < all_values.len() {
            let mut j = i;
            while j < all_values.len() && (all_values[j].0 - all_values[i].0).abs() < f64::EPSILON
            {
                j += 1;
            }
            let avg_rank = (i + 1 + j) as f64 / 2.0;
            for k in i..j {
                ranks[k] = avg_rank;
            }
            i = j;
        }

        let rank_sum_1: f64 = ranks
            .iter()
            .enumerate()
            .filter(|(idx, _)| all_values[*idx].1 == 0)
            .map(|(_, r)| r)
            .sum();

        let u1 = rank_sum_1 - (n1 as f64 * (n1 as f64 + 1.0) / 2.0);
        let u2 = (n1 as f64 * n2 as f64) - u1;
        let u_stat = u1.min(u2);

        let mu = n1 as f64 * n2 as f64 / 2.0;
        let sigma = ((n1 as f64 * n2 as f64 * (n1 as f64 + n2 as f64 + 1.0)) / 12.0).sqrt();

        let z = if sigma > 0.0 {
            (u_stat - mu) / sigma
        } else {
            0.0
        };

        let p_value = 2.0 * (1.0 - normal_cdf(z.abs()));

        let n1_f = n1 as f64;
        let n2_f = n2 as f64;
        let mean_a = a.iter().sum::<f64>() / n1_f;
        let mean_b = b.iter().sum::<f64>() / n2_f;

        let var_a: f64 = a.iter().map(|v| (v - mean_a).powi(2)).sum::<f64>() / n1_f;
        let var_b: f64 = b.iter().map(|v| (v - mean_b).powi(2)).sum::<f64>() / n2_f;

        let se = ((var_a / n1_f) + (var_b / n2_f)).sqrt();
        let z_critical = 1.96;
        let mean_diff = mean_a - mean_b;
        let ci_lower = mean_diff - z_critical * se;
        let ci_upper = mean_diff + z_critical * se;

        let effect_size = if (n1_f * n2_f) > 0.0 {
            u_stat / (n1_f * n2_f)
        } else {
            0.0
        };

        Some(MannWhitneyResult {
            u_statistic: u_stat,
            p_value,
            confidence_interval: (ci_lower, ci_upper),
            effect_size,
            mean_a,
            mean_b,
            significant_at_95: p_value < 0.05,
        })
    }
}

fn normal_cdf(x: f64) -> f64 {
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();
    let t = 1.0 / (1.0 + p * x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-x * x / 2.0).exp();
    0.5 * (1.0 + sign * y)
}

#[derive(Debug, Clone)]
pub struct MannWhitneyResult {
    pub u_statistic: f64,
    pub p_value: f64,
    pub confidence_interval: (f64, f64),
    pub effect_size: f64,
    pub mean_a: f64,
    pub mean_b: f64,
    pub significant_at_95: bool,
}
