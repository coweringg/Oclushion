use std::collections::HashMap;
use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};

use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub name: String,
    pub kind: SymbolKind,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub exported: bool,
    pub is_default_export: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SymbolKind {
    Function,
    Class,
    Variable,
    Interface,
    Type,
    Enum,
    Module,
    Import,
    Export,
}

#[derive(Debug, Default)]
pub struct SymbolIndex {
    symbols: HashMap<String, Vec<Symbol>>,
}

impl SymbolIndex {
    pub fn from_source(cached: &CachedSource) -> Self {
        let mut index = Self::default();
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let program = &ret.program;

        for stmt in &program.body {
            Self::visit_statement(stmt, &cached.path, &mut index, None);
        }

        index
    }

    fn visit_statement(stmt: &Statement, path: &PathBuf, index: &mut SymbolIndex, _export_as: Option<&str>) {
        match stmt {
            Statement::FunctionDeclaration(f) => {
                if let Some(name) = &f.id {
                    let sym = Symbol {
                        name: name.name.to_string(),
                        kind: SymbolKind::Function,
                        file: path.clone(),
                        line: f.span.start as usize,
                        column: f.span.start as usize,
                        exported: _export_as.is_some(),
                        is_default_export: _export_as == Some("default"),
                    };
                    index.add(sym);
                }
            }
            Statement::VariableDeclaration(v) => {
                for decl in &v.declarations {
                    if let BindingPattern::BindingIdentifier(id) = &decl.id {
                        let sym = Symbol {
                            name: id.name.to_string(),
                            kind: SymbolKind::Variable,
                            file: path.clone(),
                            line: decl.span.start as usize,
                            column: decl.span.start as usize,
                            exported: _export_as.is_some(),
                            is_default_export: _export_as == Some("default"),
                        };
                        index.add(sym);
                    }
                }
            }
            Statement::ExportDefaultDeclaration(e) => {
                if let ExportDefaultDeclarationKind::FunctionDeclaration(f) = &e.declaration {
                    let name = f.id.as_ref().map(|id| id.name.to_string()).unwrap_or_else(|| "default".to_string());
                    let sym = Symbol {
                        name,
                        kind: SymbolKind::Function,
                        file: path.clone(),
                        line: f.span.start as usize,
                        column: f.span.start as usize,
                        exported: true,
                        is_default_export: true,
                    };
                    index.add(sym);
                }
            }
            _ => {}
        }
    }

    pub fn get(&self, name: &str) -> Option<&Vec<Symbol>> {
        self.symbols.get(name)
    }

    pub fn all_symbols(&self) -> Vec<&Symbol> {
        self.symbols.values().flatten().collect()
    }

    pub fn add(&mut self, symbol: Symbol) {
        self.symbols.entry(symbol.name.clone()).or_default().push(symbol);
    }

    pub fn merge(&mut self, other: SymbolIndex) {
        for (name, syms) in other.symbols {
            self.symbols.entry(name).or_default().extend(syms);
        }
    }
}
