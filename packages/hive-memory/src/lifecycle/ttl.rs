use std::time::Duration;

pub struct TtlManager;

impl TtlManager {
    pub fn get_ttl(confidence: f32) -> Duration {
        if confidence < 0.7 {
            Duration::from_secs(30 * 24 * 60 * 60)
        } else if confidence < 0.8 {
            Duration::from_secs(90 * 24 * 60 * 60)
        } else {
            Duration::from_secs(365 * 24 * 60 * 60)
        }
    }
}
