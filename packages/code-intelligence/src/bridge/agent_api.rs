use std::path::Path;
use std::sync::Arc;

use crate::analysis::cost_patterns::{CostAnalyzer, CostIssue};
use crate::analysis::security_patterns::{SecurityAnalyzer, SecurityIssue};
use crate::analysis::complexity::{ComplexityAnalyzer, ComplexityMetrics};
use crate::parser::incremental::IncrementalParser;
use crate::semantic::symbols::SymbolIndex;
use crate::query::ast_query::{AstQuery, QueryMatch};
use crate::Result;

pub struct AgentApi {
    parser: Arc<IncrementalParser>,
}

impl AgentApi {
    pub fn new(parser: Arc<IncrementalParser>) -> Self {
        Self { parser }
    }

    pub fn analyze_security(&self, file_paths: &[&Path]) -> Vec<SecurityIssue> {
        let mut issues = Vec::new();
        for path in file_paths {
            if let Ok(cached) = self.parser.parse_file(path) {
                issues.extend(SecurityAnalyzer::analyze(&cached));
            }
        }
        issues
    }

    pub fn analyze_cost(&self, file_paths: &[&Path]) -> Vec<CostIssue> {
        let mut issues = Vec::new();
        for path in file_paths {
            if let Ok(cached) = self.parser.parse_file(path) {
                issues.extend(CostAnalyzer::analyze(&cached));
            }
        }
        issues
    }

    pub fn get_project_structure(&self, file_paths: &[&Path]) -> SymbolIndex {
        let mut global_idx = SymbolIndex::default();
        for path in file_paths {
            if let Ok(cached) = self.parser.parse_file(path) {
                let idx = SymbolIndex::from_source(&cached);
                global_idx.merge(idx);
            }
        }
        global_idx
    }

    pub fn get_all_functions(&self, file_paths: &[&Path]) -> Vec<QueryMatch> {
        let mut all = Vec::new();
        for path in file_paths {
            if let Ok(cached) = self.parser.parse_file(path) {
                all.extend(AstQuery::get_functions(&cached));
            }
        }
        all
    }

    pub fn get_complexity(&self, path: &Path) -> Result<ComplexityMetrics> {
        let cached = self.parser.parse_file(path)?;
        Ok(ComplexityAnalyzer::analyze(&cached))
    }
}
