use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde::{Deserialize, Serialize};
use crate::parser::ast_cache::CachedSource;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityIssue {
    pub severity: Severity,
    pub kind: SecurityVulnKind,
    pub file: PathBuf,
    pub line: usize,
    pub column: usize,
    pub snippet: String,
    pub description: String,
    pub remediation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Severity { Critical, High, Medium, Low }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SecurityVulnKind {
    EvalUsage,
    NewFunction,
    DocumentWrite,
    InnerHtmlXss,
    SqlInjection,
    CommandInjection,
    HardcodedCredential,
    InsecureRandom,
    PrototypePollution,
}

pub struct SecurityAnalyzer;

impl SecurityAnalyzer {
    pub fn analyze(cached: &CachedSource) -> Vec<SecurityIssue> {
        let allocator = Allocator::default();
        let ret = cached.parse(&allocator);
        let mut issues = Vec::new();
        for stmt in &ret.program.body {
            Self::check_statement(stmt, &cached.path, &cached.source, &mut issues);
        }
        issues
    }

    fn check_statement(stmt: &Statement, path: &PathBuf, source: &str, issues: &mut Vec<SecurityIssue>) {
        if let Statement::ExpressionStatement(e) = stmt {
            Self::check_expression(&e.expression, path, source, issues);
        }
        if let Statement::VariableDeclaration(v) = stmt {
            for decl in &v.declarations {
                if let Some(init) = &decl.init {
                    Self::check_expression(init, path, source, issues);
                    Self::check_string_for_credentials(init, path, source, issues);
                }
            }
        }
    }

    fn check_expression(expr: &Expression, path: &PathBuf, source: &str, issues: &mut Vec<SecurityIssue>) {
        match expr {
            Expression::CallExpression(call) => {
                if let Expression::Identifier(ident) = &call.callee {
                    if ident.name == "eval" {
                        issues.push(Self::make_issue(Severity::Critical, SecurityVulnKind::EvalUsage, path, call.span.start, source, "eval() ejecuta código arbitrario. Riesgo de RCE.", "Reemplazar eval() con JSON.parse() o Function constructor seguro."));
                    }
                }
                if let Some(me) = call.callee.as_member_expression() {
                    if let MemberExpression::StaticMemberExpression(static_member) = me {
                        if static_member.property.name == "exec" {
                            if let Expression::Identifier(ident) = &static_member.object {
                                if ident.name == "child_process" || ident.name == "exec" || ident.name == "execSync" {
                                    issues.push(Self::make_issue(Severity::Critical, SecurityVulnKind::CommandInjection, path, call.span.start, source, "child_process.exec con input no sanitizado permite command injection.", "Usar execFile o validate/sanitizar el input estrictamente."));
                                }
                            }
                        }
                    }
                }
                for arg in &call.arguments {
                    if let Some(arg_expr) = arg.as_expression() {
                        Self::check_sql_injection(arg_expr, path, source, issues);
                    }
                }
            }
            Expression::NewExpression(new_expr) => {
                if let Expression::Identifier(ident) = &new_expr.callee {
                    if ident.name == "Function" {
                        issues.push(Self::make_issue(Severity::High, SecurityVulnKind::NewFunction, path, new_expr.span.start, source, "new Function() ejecuta código dinámicamente. Riesgo de inyección.", "Evitar constructores de función dinámicos."));
                    }
                }
            }
            Expression::TemplateLiteral(tpl) => {
                Self::check_sql_injection_template(tpl, path, source, issues);
            }
            Expression::AssignmentExpression(assign) => {
                if let AssignmentTarget::AssignmentTargetIdentifier(ident) = &assign.left {
                    if ident.name == "innerHTML" || ident.name == "outerHTML" {
                        issues.push(Self::make_issue(Severity::High, SecurityVulnKind::InnerHtmlXss, path, assign.span.start, source, "Asignación directa a innerHTML/outerHTML. Riesgo XSS.", "Usar textContent o método seguro de la librería UI."));
                    }
                }
            }
            _ => {}
        }
    }

    fn check_sql_injection(expr: &Expression, path: &PathBuf, source: &str, issues: &mut Vec<SecurityIssue>) {
        if let Expression::TemplateLiteral(tpl) = expr {
            Self::check_sql_injection_template(tpl, path, source, issues);
        }
    }

    fn check_sql_injection_template(tpl: &TemplateLiteral, path: &PathBuf, source: &str, issues: &mut Vec<SecurityIssue>) {
        if tpl.expressions.len() > 0 {
            let text: String = tpl.quasis.iter().map(|q| q.value.raw.as_str()).collect();
            let sql_keywords = ["SELECT", "INSERT", "UPDATE", "DELETE", "FROM", "WHERE", "DROP", "CREATE"];
            if sql_keywords.iter().any(|kw| text.to_uppercase().contains(kw)) {
                issues.push(Self::make_issue(Severity::Critical, SecurityVulnKind::SqlInjection, path, tpl.span.start, source, "Template literals con interpolación en queries SQL = SQL injection.", "Usar queries parametrizados siempre."));
            }
        }
    }

    fn check_string_for_credentials(expr: &Expression, path: &PathBuf, _source: &str, issues: &mut Vec<SecurityIssue>) {
        if let Expression::StringLiteral(s) = expr {
            let val = s.value.to_lowercase();
            let patterns = ["sk-", "api_key", "apikey", "secret", "password", "token", "auth"];
            if patterns.iter().any(|p| val.contains(p)) && val.len() > 10 {
                issues.push(Self::make_issue(Severity::High, SecurityVulnKind::HardcodedCredential, path, s.span.start, _source, "Posible credencial hardcodeada en string literal.", "Usar variables de entorno o un vault de secrets."));
            }
        }
    }

    fn make_issue(severity: Severity, kind: SecurityVulnKind, path: &PathBuf, pos: u32, _source: &str, desc: &str, remediation: &str) -> SecurityIssue {
        SecurityIssue {
            severity, kind,
            file: path.clone(),
            line: pos as usize, column: pos as usize,
            snippet: String::new(),
            description: desc.to_string(),
            remediation: remediation.to_string(),
        }
    }
}
