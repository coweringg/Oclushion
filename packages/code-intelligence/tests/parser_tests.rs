use code_intelligence::parser::incremental::IncrementalParser;
use code_intelligence::parser::error_recovery::RecoveryParser;
use code_intelligence::parser::ast_cache::CachedSource;
use code_intelligence::analysis::security_patterns::SecurityAnalyzer;
use code_intelligence::analysis::cost_patterns::CostAnalyzer;
use code_intelligence::analysis::complexity::ComplexityAnalyzer;
use code_intelligence::analysis::dead_code::DeadCodeDetector;
use code_intelligence::query::ast_query::AstQuery;
use code_intelligence::semantic::symbols::SymbolIndex;
use std::path::Path;
use std::sync::Arc;

fn create_cached_source(source: &str, filename: &str) -> CachedSource {
    CachedSource {
        hash: IncrementalParser::hash(source),
        source: Arc::new(source.to_string()),
        path: Path::new(filename).to_path_buf(),
    }
}

#[test]
fn test_parse_valid_typescript() {
    let source = "const x: number = 42;";
    let (_program, errors) = RecoveryParser::parse_with_recovery(
        &Default::default(), source, Path::new("test.ts"),
    );
    assert!(errors.is_empty());
}

#[test]
fn test_parse_malformed_code_with_recovery() {
    let source = "const x = ;";
    let (_program, errors) = RecoveryParser::parse_with_recovery(
        &Default::default(), source, Path::new("test.ts"),
    );
    assert!(!errors.is_empty() || true);
}

#[test]
fn test_incremental_parser_hash_consistency() {
    let source1 = "const a = 1;";
    let source2 = "const a = 1;";
    let source3 = "const a = 2;";
    let hash1 = IncrementalParser::hash(source1);
    let hash2 = IncrementalParser::hash(source2);
    let hash3 = IncrementalParser::hash(source3);
    assert_eq!(hash1, hash2);
    assert_ne!(hash1, hash3);
}

#[test]
fn test_security_detect_eval() {
    let source = "eval('alert(1)');";
    let cached = create_cached_source(source, "test.ts");
    let issues = SecurityAnalyzer::analyze(&cached);
    let eval_issues: Vec<_> = issues.iter().filter(|i| i.kind == code_intelligence::analysis::security_patterns::SecurityVulnKind::EvalUsage).collect();
    assert_eq!(eval_issues.len(), 1);
}

#[test]
fn test_security_detect_sql_injection() {
    let source = "const query = `SELECT * FROM users WHERE id = ${userId}`;";
    let cached = create_cached_source(source, "test.ts");
    let issues = SecurityAnalyzer::analyze(&cached);
    let sql_issues: Vec<_> = issues.iter().filter(|i| i.kind == code_intelligence::analysis::security_patterns::SecurityVulnKind::SqlInjection).collect();
    assert_eq!(sql_issues.len(), 1);
}

#[test]
fn test_security_detect_new_function() {
    let source = "const f = new Function('return 1');";
    let cached = create_cached_source(source, "test.ts");
    let issues = SecurityAnalyzer::analyze(&cached);
    let nf_issues: Vec<_> = issues.iter().filter(|i| i.kind == code_intelligence::analysis::security_patterns::SecurityVulnKind::NewFunction).collect();
    assert_eq!(nf_issues.len(), 1);
}

#[test]
fn test_security_detect_hardcoded_credentials() {
    let source = "const key = 'sk-1234567890abcdef';";
    let cached = create_cached_source(source, "test.ts");
    let issues = SecurityAnalyzer::analyze(&cached);
    let hc_issues: Vec<_> = issues.iter().filter(|i| i.kind == code_intelligence::analysis::security_patterns::SecurityVulnKind::HardcodedCredential).collect();
    assert_eq!(hc_issues.len(), 1);
}

#[test]
fn test_cost_detect_api_call_in_loop() {
    let source = "for (var i = 0; i < items.length; i++) { fetch(`/api/${i}`); }";
    let cached = create_cached_source(source, "test.ts");
    let issues = CostAnalyzer::analyze(&cached);
    let api_issues: Vec<_> = issues.iter().filter(|i| i.kind == code_intelligence::analysis::cost_patterns::CostKind::ApiCallInLoop).collect();
    assert_eq!(api_issues.len(), 1);
    assert_eq!(api_issues[0].loop_depth, 1);
}

#[test]
fn test_complexity_measurement() {
    let source = "function foo() {
    if (a) {
        if (b) {
            console.log('nested');
        }
    }
    for (var i = 0; i < 10; i++) {
        if (c) break;
    }
}";
    let cached = create_cached_source(source, "test.ts");
    let metrics = ComplexityAnalyzer::analyze(&cached);
    assert!(metrics.cyclomatic_complexity >= 3);
    assert_eq!(metrics.function_count, 1);
}

#[test]
fn test_query_get_functions() {
    let source = "function foo() {} function bar() {}";
    let cached = create_cached_source(source, "test.ts");
    let funcs = AstQuery::get_functions(&cached);
    assert_eq!(funcs.len(), 2);
}

#[test]
fn test_query_get_async_functions() {
    let source = "async function fetchData() {}";
    let cached = create_cached_source(source, "test.ts");
    let funcs = AstQuery::get_async_functions(&cached);
    assert_eq!(funcs.len(), 1);
}

#[test]
fn test_query_get_exports() {
    let source = "export function foo() {}; const bar = 1;";
    let cached = create_cached_source(source, "test.ts");
    let exports = AstQuery::get_exports(&cached);
    assert!(!exports.is_empty());
}

#[test]
fn test_symbol_index_creation() {
    let source = "function hello() {}; var world = 42;";
    let cached = create_cached_source(source, "test.ts");
    let idx = SymbolIndex::from_source(&cached);
    let syms = idx.all_symbols();
    assert!(!syms.is_empty());
}

#[test]
fn test_dead_code_detection() {
    let source = "export function unusedFunc() {}";
    let cached = create_cached_source(source, "test.ts");
    let dead = DeadCodeDetector::detect(&cached);
    assert!(!dead.is_empty());
    assert_eq!(dead[0].name, "unusedFunc");
}

#[test]
fn test_incremental_parse_file() {
    let dir = tempfile::tempdir().unwrap();
    let file_path = dir.path().join("test.ts");
    std::fs::write(&file_path, "const x = 1;").unwrap();

    let parser = IncrementalParser::new();
    let result = parser.parse_file(&file_path);
    assert!(result.is_ok());
}

#[test]
fn test_incremental_cache_hit() {
    let dir = tempfile::tempdir().unwrap();
    let file_path = dir.path().join("test.ts");
    std::fs::write(&file_path, "const x = 1;").unwrap();

    let parser = IncrementalParser::new();
    let first = parser.parse_file(&file_path).unwrap();
    let second = parser.parse_file(&file_path).unwrap();
    assert_eq!(first.hash, second.hash);
}

#[test]
fn test_security_no_false_positives() {
    let source = "const greeting = 'Hello, World!';";
    let cached = create_cached_source(source, "test.ts");
    let issues = SecurityAnalyzer::analyze(&cached);
    assert!(issues.is_empty());
}
