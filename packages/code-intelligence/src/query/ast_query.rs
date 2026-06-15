use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryMatch {
    pub kind: String,
    pub name: Option<String>,
    pub line: usize,
    pub column: usize,
}

pub struct AstQuery;

impl AstQuery {
    pub fn get_functions(cached: &CachedSource) -> Vec<QueryMatch> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut results = Vec::new();
        for stmt in &ret.program.body {
            if let Statement::FunctionDeclaration(f) = stmt {
                results.push(QueryMatch {
                    kind: "function".to_string(),
                    name: f.id.as_ref().map(|id| id.name.to_string()),
                    line: f.span.start as usize,
                    column: f.span.start as usize,
                });
            }
            if let Statement::ExportNamedDeclaration(e) = stmt {
                if let Some(Declaration::FunctionDeclaration(f)) = &e.declaration {
                    results.push(QueryMatch {
                        kind: "exported_function".to_string(),
                        name: f.id.as_ref().map(|id| id.name.to_string()),
                        line: f.span.start as usize,
                        column: f.span.start as usize,
                    });
                }
            }
        }
        results
    }

    pub fn get_async_functions(cached: &CachedSource) -> Vec<QueryMatch> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut results = Vec::new();
        for stmt in &ret.program.body {
            if let Statement::FunctionDeclaration(f) = stmt {
                if f.r#async {
                    results.push(QueryMatch {
                        kind: "async_function".to_string(),
                        name: f.id.as_ref().map(|id| id.name.to_string()),
                        line: f.span.start as usize,
                        column: f.span.start as usize,
                    });
                }
            }
        }
        results
    }

    pub fn get_classes(cached: &CachedSource) -> Vec<QueryMatch> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut results = Vec::new();
        for stmt in &ret.program.body {
            if let Statement::ClassDeclaration(c) = stmt {
                results.push(QueryMatch {
                    kind: "class".to_string(),
                    name: c.id.as_ref().map(|id| id.name.to_string()),
                    line: c.span.start as usize,
                    column: c.span.start as usize,
                });
            }
        }
        results
    }

    pub fn get_exports(cached: &CachedSource) -> Vec<QueryMatch> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut results = Vec::new();
        for stmt in &ret.program.body {
            match stmt {
                Statement::ExportNamedDeclaration(e) => {
                    if let Some(decl) = &e.declaration {
                        Self::extract_names_from_decl(decl, &mut results, "export");
                    }
                }
                Statement::ExportDefaultDeclaration(_) => {
                    results.push(QueryMatch {
                        kind: "export_default".to_string(),
                        name: Some("default".to_string()),
                        line: 0,
                        column: 0,
                    });
                }
                _ => {}
            }
        }
        results
    }

    fn extract_names_from_decl(decl: &Declaration, results: &mut Vec<QueryMatch>, prefix: &str) {
        match decl {
            Declaration::FunctionDeclaration(f) => {
                if let Some(id) = &f.id {
                    results.push(QueryMatch {
                        kind: format!("{prefix}_function"),
                        name: Some(id.name.to_string()),
                        line: f.span.start as usize,
                        column: f.span.start as usize,
                    });
                }
            }
            Declaration::VariableDeclaration(v) => {
                for d in &v.declarations {
                    if let BindingPattern::BindingIdentifier(ident) = &d.id {
                        results.push(QueryMatch {
                            kind: format!("{prefix}_variable"),
                            name: Some(ident.name.to_string()),
                            line: d.span.start as usize,
                            column: d.span.start as usize,
                        });
                    }
                }
            }
            _ => {}
        }
    }
}
