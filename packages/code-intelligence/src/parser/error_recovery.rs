use std::path::Path;
use std::time::Duration;

use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_diagnostics::OxcDiagnostic;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;

pub struct RecoveryParser;

impl RecoveryParser {
    pub fn parse_with_recovery<'a>(allocator: &'a Allocator, source: &'a str, path: &Path) -> (Program<'a>, Vec<OxcDiagnostic>) {
        let source_type = Self::infer_source_type(path, source);
        let ret: ParserReturn<'a> = Parser::new(allocator, source, source_type).parse();
        let errors: Vec<OxcDiagnostic> = ret.errors;
        (ret.program, errors)
    }

    pub fn parse_with_timeout<'a>(allocator: &'a Allocator, source: &'a str, path: &Path, timeout: Duration) -> Option<(Program<'a>, Vec<OxcDiagnostic>)> {
        let start = std::time::Instant::now();
        let result = Self::parse_with_recovery(allocator, source, path);
        if start.elapsed() > timeout {
            return None;
        }
        Some(result)
    }

    fn infer_source_type(path: &Path, _source: &str) -> SourceType {
        SourceType::from_path(path)
            .unwrap_or_else(|_| SourceType::mjs())
    }
}
