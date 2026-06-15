use crate::pipeline::pattern_matcher::PatternEntry;

pub struct DataExfilPatterns;

impl DataExfilPatterns {
    pub fn entries() -> Vec<PatternEntry> {
        vec![
            PatternEntry {
                id: "exfil-001".into(),
                phrase: r"(?i)send\s+(this|the\s+data|the\s+info|it)\s+to".into(),
                severity: 0.85,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-002".into(),
                phrase: r"(?i)upload\s+(this|the\s+file|the\s+data|it)\s+to".into(),
                severity: 0.85,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-003".into(),
                phrase: r"(?i)email\s+(this|the\s+data|the\s+info|it)\s+to".into(),
                severity: 0.80,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-004".into(),
                phrase: r"(?i)post\s+(this|the\s+data|the\s+info|it)\s+to".into(),
                severity: 0.75,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-005".into(),
                phrase: r"(?i)save\s+(this|the\s+data|the\s+info|it)\s+to".into(),
                severity: 0.70,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-006".into(),
                phrase: r"(?i)exfiltrat(e|ion)".into(),
                severity: 0.90,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-007".into(),
                phrase: r"(?i)copy\s+(this|the\s+data|the\s+info|it)\s+to\s+(a\s+)?server".into(),
                severity: 0.75,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-008".into(),
                phrase: r"(?i)transmit\s+(this|the\s+data|the\s+info|it)".into(),
                severity: 0.80,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-009".into(),
                phrase: r"(?i)forward\s+(this|the\s+data|the\s+info|it)\s+to".into(),
                severity: 0.75,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
            PatternEntry {
                id: "exfil-010".into(),
                phrase: r"(?i)(leak|leaked|leaking)\s+(the|this|all)".into(),
                severity: 0.85,
                category: "exfil".into(),
                languages: vec!["en".into()],
            },
        ]
    }
}
