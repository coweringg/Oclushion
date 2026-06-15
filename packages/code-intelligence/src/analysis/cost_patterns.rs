use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostIssue {
    pub kind: CostKind,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub loop_depth: usize,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CostKind {
    ApiCallInLoop,
    DbQueryInLoop,
    FileSystemInLoop,
    NestedLoop,
}

pub struct CostAnalyzer;

impl CostAnalyzer {
    pub fn analyze(cached: &CachedSource) -> Vec<CostIssue> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut issues = Vec::new();
        for stmt in &ret.program.body {
            Self::check_statement(stmt, &cached.path, 0, &mut issues);
        }
        issues
    }

    fn check_statement(stmt: &Statement, path: &PathBuf, depth: usize, issues: &mut Vec<CostIssue>) {
        let (new_depth, body_stmts) = match stmt {
            Statement::ForStatement(f) => (depth + 1, Self::stmt_to_vec(&f.body)),
            Statement::ForInStatement(f) => (depth + 1, Self::stmt_to_vec(&f.body)),
            Statement::ForOfStatement(f) => (depth + 1, Self::stmt_to_vec(&f.body)),
            Statement::WhileStatement(w) => (depth + 1, Self::stmt_to_vec(&w.body)),
            _ => (depth, vec![]),
        };

        for s in body_stmts {
            Self::check_statement(s, path, new_depth, issues);
        }

        if new_depth > depth {
            return;
        }

        if let Statement::ExpressionStatement(e) = stmt {
            Self::check_expression_for_cost(&e.expression, path, depth, issues);
        }
    }

    fn stmt_to_vec<'a>(stmt: &'a Statement<'a>) -> Vec<&'a Statement<'a>> {
        if let Statement::BlockStatement(block) = stmt {
            block.body.iter().collect()
        } else {
            vec![stmt]
        }
    }

    fn check_expression_for_cost(expr: &Expression, path: &PathBuf, depth: usize, issues: &mut Vec<CostIssue>) {
        if let Expression::CallExpression(call) = expr {
            let callee_str = Self::callee_name(call);
            let is_api = callee_str == "fetch" || callee_str.contains("axios") || callee_str.contains("$.ajax");
            let is_db = callee_str.contains("prisma") || callee_str.contains("findMany")
                || callee_str.contains("findUnique") || callee_str.contains("create")
                || callee_str.contains("queryRaw") || callee_str.contains("$query")
                || callee_str.contains("entityManager") || callee_str.contains("repository");
            let is_fs = callee_str.contains("readFile") || callee_str.contains("writeFile")
                || callee_str.contains("readdir") || callee_str.contains("unlink");

            if depth > 0 && is_api {
                issues.push(CostIssue {
                    kind: CostKind::ApiCallInLoop, file: path.clone(),
                    line: call.span.start as usize, column: call.span.start as usize,
                    loop_depth: depth,
                    description: format!("Llamada a API ({}) dentro de un loop (profundidad {}). Puede causar alto costo en facturación de APIs externas.", callee_str, depth),
                });
            }
            if depth > 0 && is_db {
                issues.push(CostIssue {
                    kind: CostKind::DbQueryInLoop, file: path.clone(),
                    line: call.span.start as usize, column: call.span.start as usize,
                    loop_depth: depth,
                    description: format!("Query a BD ({}) dentro de un loop (profundidad {}). Riesgo de N+1 queries.", callee_str, depth),
                });
            }
            if depth > 0 && is_fs {
                issues.push(CostIssue {
                    kind: CostKind::FileSystemInLoop, file: path.clone(),
                    line: call.span.start as usize, column: call.span.start as usize,
                    loop_depth: depth,
                    description: format!("Operación de filesystem ({}) dentro de un loop (profundidad {}). Costoso en I/O.", callee_str, depth),
                });
            }
        }
    }

    fn callee_name(call: &CallExpression) -> String {
        match &call.callee {
            Expression::Identifier(ident) => ident.name.to_string(),
            _ => "unknown".to_string(),
        }
    }
}
