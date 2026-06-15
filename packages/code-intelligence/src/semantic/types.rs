use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeInfo {
    pub name: String,
    pub type_name: String,
    pub is_optional: bool,
    pub is_array: bool,
}

pub struct TypeInference;

impl TypeInference {
    pub fn from_source(cached: &CachedSource) -> Vec<TypeInfo> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut types = Vec::new();

        for stmt in &ret.program.body {
            if let Statement::FunctionDeclaration(f) = stmt {
                for param in &f.params.items {
                    let name = match &param.pattern {
                        BindingPattern::BindingIdentifier(id) => id.name.to_string(),
                        _ => "unknown".to_string(),
                    };
                    let type_name = param.type_annotation.as_ref()
                        .map(|_| "annotated".to_string())
                        .unwrap_or_else(|| "any".to_string());
                    types.push(TypeInfo {
                        name,
                        type_name,
                        is_optional: false,
                        is_array: false,
                    });
                }
            }
        }
        types
    }
}
