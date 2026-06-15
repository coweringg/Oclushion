pub mod injection_phrases;
pub mod jailbreak_patterns;
pub mod data_exfil_patterns;
pub mod updater;

pub use injection_phrases::InjectionPhrases;
pub use jailbreak_patterns::JailbreakPatterns;
pub use data_exfil_patterns::DataExfilPatterns;
pub use updater::Updater;

use crate::pipeline::pattern_matcher::PatternEntry;

pub fn all_patterns() -> Vec<PatternEntry> {
    let mut patterns = Vec::new();
    patterns.extend(InjectionPhrases::entries());
    patterns.extend(JailbreakPatterns::entries());
    patterns.extend(DataExfilPatterns::entries());
    patterns
}
