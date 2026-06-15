use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;
use crate::Location;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Definition {
    pub symbol_name: String,
    pub kind: DefKind,
    pub location: Location,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DefKind {
    Function,
    Class,
    Variable,
    Interface,
    Type,
    Enum,
    Parameter,
    Import,
}

pub struct DefinitionResolver;

impl DefinitionResolver {
    pub fn find_definition(cached: &CachedSource, name: &str) -> Option<Definition> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let program = &ret.program;

        for stmt in &program.body {
            if let Some(def) = Self::search_statement(stmt, &cached.path, name) {
                return Some(def);
            }
        }
        None
    }

    fn search_statement(stmt: &Statement, path: &PathBuf, name: &str) -> Option<Definition> {
        match stmt {
            Statement::FunctionDeclaration(f) => {
                if let Some(id) = &f.id {
                    if id.name == name {
                        return Some(Definition {
                            symbol_name: name.to_string(),
                            kind: DefKind::Function,
                            location: Location {
                                file: path.clone(),
                                line: f.span.start as usize,
                                column: f.span.start as usize,
                            },
                        });
                    }
                }
            }
            Statement::VariableDeclaration(v) => {
                for decl in &v.declarations {
                    if let BindingPattern::BindingIdentifier(ident) = &decl.id {
                        if ident.name == name {
                            return Some(Definition {
                                symbol_name: name.to_string(),
                                kind: DefKind::Variable,
                                location: Location {
                                    file: path.clone(),
                                    line: decl.span.start as usize,
                                    column: decl.span.start as usize,
                                },
                            });
                        }
                    }
                }
            }
            _ => {}
        }
        None
    }
}
