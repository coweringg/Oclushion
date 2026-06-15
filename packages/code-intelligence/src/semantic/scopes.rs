use std::collections::HashMap;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scope {
    pub id: usize,
    pub parent_id: Option<usize>,
    pub kind: ScopeKind,
    pub children: Vec<usize>,
    pub bindings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ScopeKind {
    Global,
    Function,
    Block,
    Module,
    Class,
    Loop,
}

pub struct ScopeGraph {
    scopes: HashMap<usize, Scope>,
    root_id: usize,
}

impl ScopeGraph {
    pub fn from_source(cached: &CachedSource) -> Self {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut graph = Self { scopes: HashMap::new(), root_id: 0 };

        let root = Scope {
            id: 0, parent_id: None, kind: ScopeKind::Module,
            children: vec![], bindings: vec![],
        };
        graph.scopes.insert(0, root);

        let mut counter = 0usize;
        for stmt in &ret.program.body {
            graph.visit_statement(stmt, 0, &mut counter);
        }
        graph
    }

    fn visit_statement(&mut self, stmt: &Statement, parent_id: usize, counter: &mut usize) {
        if let Statement::FunctionDeclaration(f) = stmt {
            *counter += 1;
            let id = *counter;
            let bindings = f.params.items.iter()
                .filter_map(|p| {
                    if let BindingPattern::BindingIdentifier(ident) = &p.pattern {
                        Some(ident.name.to_string())
                    } else {
                        None
                    }
                })
                .collect();
            let scope = Scope {
                id, parent_id: Some(parent_id), kind: ScopeKind::Function,
                children: vec![], bindings,
            };
            self.scopes.insert(id, scope);
            if let Some(parent) = self.scopes.get_mut(&parent_id) {
                parent.children.push(id);
            }
            if let Some(body) = &f.body {
                for s in &body.statements {
                    self.visit_statement(s, id, counter);
                }
            }
        }
    }

    pub fn root(&self) -> Option<&Scope> { self.scopes.get(&self.root_id) }
    pub fn get(&self, id: usize) -> Option<&Scope> { self.scopes.get(&id) }
    pub fn all(&self) -> Vec<&Scope> { self.scopes.values().collect() }
}
