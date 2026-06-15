use std::collections::HashMap;
use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;
use crate::Location;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub symbol_name: String,
    pub location: Location,
    pub context: String,
}

pub struct ReferenceIndex {
    references: HashMap<String, Vec<Reference>>,
}

impl ReferenceIndex {
    pub fn new() -> Self {
        Self { references: HashMap::new() }
    }

    pub fn from_source(cached: &CachedSource) -> Self {
        let mut idx = Self::new();
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        for stmt in &ret.program.body {
            Self::visit_stmt(stmt, &cached.path, &mut idx);
        }
        idx
    }

    fn visit_stmt(stmt: &Statement, path: &PathBuf, idx: &mut ReferenceIndex) {
        if let Statement::ExpressionStatement(e) = stmt {
            Self::visit_expr(&e.expression, path, idx);
        }
    }

    fn visit_expr(expr: &Expression, path: &PathBuf, idx: &mut ReferenceIndex) {
        match expr {
            Expression::CallExpression(call) => {
                if let Some(name) = Self::extract_call_name(call) {
                    idx.add(Reference {
                        symbol_name: name,
                        location: Location {
                            file: path.clone(),
                            line: call.span.start as usize,
                            column: call.span.start as usize,
                        },
                        context: "call".to_string(),
                    });
                }
                for arg in &call.arguments {
                    if let Some(arg_expr) = arg.as_expression() {
                        Self::visit_expr(arg_expr, path, idx);
                    }
                }
            }
            Expression::Identifier(ident) => {
                idx.add(Reference {
                    symbol_name: ident.name.to_string(),
                    location: Location {
                        file: path.clone(),
                        line: ident.span.start as usize,
                        column: ident.span.start as usize,
                    },
                    context: "identifier".to_string(),
                });
            }
            _ => {}
        }
    }

    fn extract_call_name(call: &CallExpression) -> Option<String> {
        match &call.callee {
            Expression::Identifier(ident) => Some(ident.name.to_string()),
            _ => None,
        }
    }

    pub fn find_references(&self, name: &str) -> Vec<&Reference> {
        self.references.get(name).map(|v| v.iter().collect()).unwrap_or_default()
    }

    pub fn add(&mut self, reference: Reference) {
        self.references.entry(reference.symbol_name.clone()).or_default().push(reference);
    }

    pub fn merge(&mut self, other: ReferenceIndex) {
        for (name, refs) in other.references {
            self.references.entry(name).or_default().extend(refs);
        }
    }
}
