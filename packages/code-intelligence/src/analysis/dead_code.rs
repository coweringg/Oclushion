use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeadCode {
    pub name: String,
    pub kind: String,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
}

pub struct DeadCodeDetector;

impl DeadCodeDetector {
    pub fn detect(cached: &CachedSource) -> Vec<DeadCode> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let program = &ret.program;
        let mut dead = Vec::new();

        for stmt in &program.body {
            match stmt {
                Statement::ExportNamedDeclaration(export) => {
                    if let Some(decl) = &export.declaration {
                        Self::check_declaration(decl, &cached.path, &mut dead);
                    }
                }
                Statement::ExportDefaultDeclaration(export) => {
                    if let ExportDefaultDeclarationKind::FunctionDeclaration(f) = &export.declaration {
                        let name = f.id.as_ref().map(|id| id.name.to_string()).unwrap_or_else(|| "default".to_string());
                        dead.push(DeadCode { name, kind: "function".to_string(), file: cached.path.clone(), line: f.span.start as usize, column: f.span.start as usize });
                    }
                }
                _ => {}
            }
        }
        dead
    }

    fn check_declaration(decl: &Declaration, path: &PathBuf, dead: &mut Vec<DeadCode>) {
        match decl {
            Declaration::FunctionDeclaration(f) => {
                if let Some(id) = &f.id {
                    dead.push(DeadCode { name: id.name.to_string(), kind: "function".to_string(), file: path.clone(), line: f.span.start as usize, column: f.span.start as usize });
                }
            }
            Declaration::VariableDeclaration(v) => {
                for d in &v.declarations {
                    if let BindingPattern::BindingIdentifier(ident) = &d.id {
                        dead.push(DeadCode { name: ident.name.to_string(), kind: "variable".to_string(), file: path.clone(), line: d.span.start as usize, column: d.span.start as usize });
                    }
                }
            }
            _ => {}
        }
    }
}
