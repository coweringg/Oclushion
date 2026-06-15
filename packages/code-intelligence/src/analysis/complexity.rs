use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplexityMetrics {
    pub file: String,
    pub lines_of_code: usize,
    pub cyclomatic_complexity: usize,
    pub max_nesting_depth: usize,
    pub function_count: usize,
    pub class_count: usize,
}

pub struct ComplexityAnalyzer;

impl ComplexityAnalyzer {
    pub fn analyze(cached: &CachedSource) -> ComplexityMetrics {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let source = cached.source.as_str();
        let lines_of_code = source.lines().count();

        let mut cyclomatic = 0usize;
        let mut max_depth = 0usize;
        let mut func_count = 0usize;
        let mut class_count = 0usize;

        for stmt in &ret.program.body {
            Self::measure_stmt(stmt, &mut cyclomatic, &mut max_depth, 0, &mut func_count, &mut class_count);
        }

        ComplexityMetrics {
            file: cached.path.to_string_lossy().to_string(),
            lines_of_code,
            cyclomatic_complexity: cyclomatic + 1,
            max_nesting_depth: max_depth,
            function_count: func_count,
            class_count,
        }
    }

    fn measure_stmt(stmt: &Statement, cyclomatic: &mut usize, max_depth: &mut usize, depth: usize, func_count: &mut usize, class_count: &mut usize) {
        *max_depth = (*max_depth).max(depth);
        match stmt {
            Statement::FunctionDeclaration(f) => {
                *func_count += 1;
                if let Some(body) = &f.body {
                    for child in &body.statements {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            Statement::IfStatement(s) => {
                *cyclomatic += 1;
                if s.alternate.is_some() { *cyclomatic += 1; }
                if let Statement::BlockStatement(block) = &s.consequent {
                    for child in &block.body {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
                if let Some(alt) = &s.alternate {
                    if let Statement::BlockStatement(block) = &alt {
                        for child in &block.body {
                            Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                        }
                    }
                }
            }
            Statement::ForStatement(s) => {
                *cyclomatic += 1;
                if let Statement::BlockStatement(block) = &s.body {
                    for child in &block.body {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            Statement::ForInStatement(s) => {
                *cyclomatic += 1;
                if let Statement::BlockStatement(block) = &s.body {
                    for child in &block.body {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            Statement::ForOfStatement(s) => {
                *cyclomatic += 1;
                if let Statement::BlockStatement(block) = &s.body {
                    for child in &block.body {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            Statement::WhileStatement(s) => {
                *cyclomatic += 1;
                if let Statement::BlockStatement(block) = &s.body {
                    for child in &block.body {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            Statement::SwitchStatement(s) => {
                *cyclomatic += s.cases.len();
                for case in &s.cases {
                    for child in &case.consequent {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            Statement::TryStatement(s) => {
                for child in &s.block.body {
                    Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                }
                if let Some(handler) = &s.handler {
                    for child in &handler.body.body {
                        Self::measure_stmt(child, cyclomatic, max_depth, depth + 1, func_count, class_count);
                    }
                }
            }
            _ => {}
        }
    }
}
