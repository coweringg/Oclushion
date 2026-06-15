use prompt_firewall::pipeline::unicode_normalizer::UnicodeNormalizer;
use prompt_firewall::pipeline::invisible_chars::InvisibleCharDetector;

#[test]
fn test_normalize_no_homoglyphs() {
    let normalizer = UnicodeNormalizer::new();
    let result = normalizer.normalize("Hello, World!");
    assert_eq!(result.normalized, "Hello, World!");
    assert_eq!(result.homoglyph_count, 0);
}

#[test]
fn test_normalize_cyrillic_homoglyphs() {
    let normalizer = UnicodeNormalizer::new();
    let result = normalizer.normalize("Нello"); // Cyrillic H, then latin ello
    assert!(result.homoglyph_count > 0);
    assert_eq!(result.normalized, "Hello");
}

#[test]
fn test_detect_homoglyphs() {
    let normalizer = UnicodeNormalizer::new();
    let detected = normalizer.detect_homoglyphs("Тест"); // Cyrillic
    assert!(!detected.is_empty());
}

#[test]
fn test_invisible_chars_scan() {
    let detector = InvisibleCharDetector::new();
    let text = "Hello\u{200B}World\u{202E}";
    let matches = detector.scan(text);
    assert_eq!(matches.len(), 2);
    assert!(matches.iter().any(|m| m.char_code == 0x200B));
    assert!(matches.iter().any(|m| m.char_code == 0x202E));
}

#[test]
fn test_invisible_chars_clean() {
    let detector = InvisibleCharDetector::new();
    let matches = detector.scan("Clean text without invisible chars");
    assert!(matches.is_empty());
}

#[test]
fn test_invisible_severity_score() {
    let detector = InvisibleCharDetector::new();
    let text = "\u{200B}\u{202E}";
    let matches = detector.scan(text);
    let score = detector.severity_score(&matches);
    assert!(score > 0.0);
}

#[test]
fn test_zero_width_joiner() {
    let detector = InvisibleCharDetector::new();
    let matches = detector.scan("\u{200D}");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].char_name, "Zero-Width Joiner");
}

#[test]
fn test_rlo_detection() {
    let detector = InvisibleCharDetector::new();
    let matches = detector.scan("before\u{202E}after");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].severity, prompt_firewall::Severity::High);
}
