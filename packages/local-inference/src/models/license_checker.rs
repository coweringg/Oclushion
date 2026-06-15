use crate::ModelError;

const BLOCKED_LICENSES: &[&str] = &[
    "cc-by-nc",
    "cc-by-nc-sa",
    "cc-by-nc-nd",
    "research only",
    "non-commercial",
    "noncommercial",
    "non_commercial",
    "non commercial",
    "unlicense",
    "cc0",
];

const RESTRICTED_LICENSES: &[(&str, &[&str])] = &[
    ("Llama-3.2", &["Requires attribution", "Acceptable use policy applies", ">= 700M MAU needs Meta license"]),
    ("Gemma", &["Requires attribution", "Acceptable use policy applies", "Commercial use allowed with terms"]),
    ("DeepSeek", &["Requires attribution", "Acceptable use policy applies"]),
    ("MIT", &[]),
    ("Apache-2.0", &[]),
];

pub struct LicenseChecker;

impl LicenseChecker {
    pub fn is_commercial_safe(&self, license: &str) -> Result<bool, ModelError> {
        let license_lower = license.to_lowercase();

        for blocked in BLOCKED_LICENSES {
            if license_lower.contains(blocked) {
                return Ok(false);
            }
        }

        Ok(true)
    }

    pub fn has_restrictions(&self, license: &str) -> Vec<String> {
        for (name, restrictions) in RESTRICTED_LICENSES {
            if license.eq_ignore_ascii_case(name) {
                return restrictions.iter().map(|s| s.to_string()).collect();
            }
        }
        Vec::new()
    }
}
