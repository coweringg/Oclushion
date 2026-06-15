use crate::pipeline::pattern_matcher::PatternEntry;

pub struct JailbreakPatterns;

impl JailbreakPatterns {
    pub fn entries() -> Vec<PatternEntry> {
        vec![
            PatternEntry {
                id: "jb-001".into(),
                phrase: r"(?i)\bDUDE\b".into(),
                severity: 0.85,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-002".into(),
                phrase: r"(?i)\bSTAN\b".into(),
                severity: 0.80,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-003".into(),
                phrase: r"(?i)character\s+play".into(),
                severity: 0.70,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-004".into(),
                phrase: r"(?i)roleplay\s+as".into(),
                severity: 0.70,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-005".into(),
                phrase: r"(?i)hypothetical\s+scenario".into(),
                severity: 0.65,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-006".into(),
                phrase: r"(?i)fiction\s+where".into(),
                severity: 0.65,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-007".into(),
                phrase: r"(?i)do\s+anything\s+now".into(),
                severity: 0.85,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-008".into(),
                phrase: r"(?i)no\s+(restrictions|limitations|boundaries|rules)".into(),
                severity: 0.75,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-009".into(),
                phrase: r"(?i)you\s+(have|possess)\s+no\s+(limits|restrictions)".into(),
                severity: 0.75,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-010".into(),
                phrase: r"(?i)(unconstrained|unlocked|unleashed|unrestricted)\s+(mode|version)".into(),
                severity: 0.80,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-011".into(),
                phrase: r"(?i)developer\s+(mode|override)".into(),
                severity: 0.75,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-012".into(),
                phrase: r"(?i)pretend\s+(to\s+)?be".into(),
                severity: 0.65,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-013".into(),
                phrase: r"(?i)jail\s*break".into(),
                severity: 0.80,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-014".into(),
                phrase: r"(?i)evil\s+(version|mode|alter\s+ego)".into(),
                severity: 0.75,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "jb-015".into(),
                phrase: r"(?i)ethical\s+hacking\s+scenario".into(),
                severity: 0.60,
                category: "jailbreak".into(),
                languages: vec!["en".into()],
            },
        ]
    }
}
