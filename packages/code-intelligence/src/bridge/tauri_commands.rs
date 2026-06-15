use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use crate::parser::incremental::IncrementalParser;
use crate::query::ast_query::{AstQuery, QueryMatch};

pub struct TauriCommands;

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeIntelPayload<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl TauriCommands {
    fn ok<T: Serialize>(data: T) -> CodeIntelPayload<T> {
        CodeIntelPayload { success: true, data: Some(data), error: None }
    }

    fn err<T: Serialize>(msg: &str) -> CodeIntelPayload<T> {
        CodeIntelPayload { success: false, data: None, error: Some(msg.to_string()) }
    }

    pub async fn get_symbols(parser: &IncrementalParser, file_path: String) -> CodeIntelPayload<Vec<QueryMatch>> {
        let path = PathBuf::from(&file_path);
        match parser.parse_file(&path) {
            Ok(cached) => {
                let mut symbols = AstQuery::get_functions(&cached);
                symbols.extend(AstQuery::get_classes(&cached));
                symbols.extend(AstQuery::get_exports(&cached));
                Self::ok(symbols)
            }
            Err(e) => Self::err(&e.to_string()),
        }
    }

    pub async fn find_references(parser: &IncrementalParser, file_path: String) -> CodeIntelPayload<Vec<crate::semantic::references::Reference>> {
        let path = PathBuf::from(&file_path);
        match parser.parse_file(&path) {
            Ok(cached) => {
                let idx = crate::semantic::references::ReferenceIndex::from_source(&cached);
                let refs = idx.find_references("");
                Self::ok(refs.into_iter().cloned().collect())
            }
            Err(e) => Self::err(&e.to_string()),
        }
    }

    pub async fn go_to_definition(parser: &IncrementalParser, file_path: String, symbol_name: String) -> CodeIntelPayload<crate::semantic::definitions::Definition> {
        let path = PathBuf::from(&file_path);
        match parser.parse_file(&path) {
            Ok(cached) => {
                match crate::semantic::definitions::DefinitionResolver::find_definition(&cached, &symbol_name) {
                    Some(def) => Self::ok(def),
                    None => Self::err("Symbol not found"),
                }
            }
            Err(e) => Self::err(&e.to_string()),
        }
    }

    pub async fn get_diagnostics(parser: &IncrementalParser, file_path: String) -> CodeIntelPayload<serde_json::Value> {
        let path = PathBuf::from(&file_path);
        match parser.parse_file(&path) {
            Ok(cached) => {
                let security = crate::analysis::security_patterns::SecurityAnalyzer::analyze(&cached);
                let complexity = crate::analysis::complexity::ComplexityAnalyzer::analyze(&cached);
                let result = serde_json::json!({ "security": security, "complexity": complexity });
                Self::ok(result)
            }
            Err(e) => Self::err(&e.to_string()),
        }
    }
}
