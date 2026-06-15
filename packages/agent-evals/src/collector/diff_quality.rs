pub struct DiffQuality;

impl DiffQuality {
    pub fn ratio(lines_changed: u64, lines_that_needed_change: u64) -> f64 {
        if lines_that_needed_change == 0 {
            if lines_changed == 0 {
                return 1.0;
            }
            return 0.0;
        }
        let r = lines_changed as f64 / lines_that_needed_change as f64;
        r.min(1.0).max(0.0)
    }

    pub fn precision_recall(
        lines_changed_correctly: u64,
        total_lines_changed: u64,
        total_lines_that_needed_change: u64,
    ) -> (f64, f64, f64) {
        let precision = if total_lines_changed == 0 {
            0.0
        } else {
            lines_changed_correctly as f64 / total_lines_changed as f64
        };
        let recall = if total_lines_that_needed_change == 0 {
            0.0
        } else {
            lines_changed_correctly as f64 / total_lines_that_needed_change as f64
        };
        let f1 = if precision + recall == 0.0 {
            0.0
        } else {
            2.0 * precision * recall / (precision + recall)
        };
        (precision, recall, f1)
    }
}
