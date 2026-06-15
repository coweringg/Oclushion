use crate::AgentRole;

pub struct CompilationCheck;

impl CompilationCheck {
    pub fn check(code: &str, _agent_role: &AgentRole) -> bool {
        if code.trim().is_empty() {
            return false;
        }
        let mut curly = 0i64;
        let mut square = 0i64;
        let mut paren = 0i64;
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let chars: Vec<char> = code.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            if c == '\\' && i + 1 < chars.len() {
                i += 2;
                continue;
            }
            if c == '\'' && !in_double_quote {
                in_single_quote = !in_single_quote;
                i += 1;
                continue;
            }
            if c == '"' && !in_single_quote {
                in_double_quote = !in_double_quote;
                i += 1;
                continue;
            }
            if !in_single_quote && !in_double_quote {
                match c {
                    '{' => curly += 1,
                    '}' => curly -= 1,
                    '[' => square += 1,
                    ']' => square -= 1,
                    '(' => paren += 1,
                    ')' => paren -= 1,
                    _ => {}
                }
            }
            i += 1;
        }
        if in_single_quote || in_double_quote {
            return false;
        }
        curly == 0 && square == 0 && paren == 0
    }

    pub fn check_with_detail(code: &str, _agent_role: &AgentRole) -> CompilationResult {
        let passed = Self::check(code, _agent_role);
        let mut issues = Vec::new();
        if code.trim().is_empty() {
            issues.push("code is empty".to_string());
        }
        let mut curly = 0i64;
        let mut square = 0i64;
        let mut paren = 0i64;
        let mut in_single_quote = false;
        let mut in_double_quote = false;
        let chars: Vec<char> = code.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            if c == '\\' && i + 1 < chars.len() {
                i += 2;
                continue;
            }
            if c == '\'' && !in_double_quote {
                in_single_quote = !in_single_quote;
                i += 1;
                continue;
            }
            if c == '"' && !in_single_quote {
                in_double_quote = !in_double_quote;
                i += 1;
                continue;
            }
            if !in_single_quote && !in_double_quote {
                match c {
                    '{' => curly += 1,
                    '}' => curly -= 1,
                    '[' => square += 1,
                    ']' => square -= 1,
                    '(' => paren += 1,
                    ')' => paren -= 1,
                    _ => {}
                }
            }
            i += 1;
        }
        if curly != 0 {
            issues.push(format!("unbalanced curly braces: {}", curly));
        }
        if square != 0 {
            issues.push(format!("unbalanced square brackets: {}", square));
        }
        if paren != 0 {
            issues.push(format!("unbalanced parentheses: {}", paren));
        }
        if in_single_quote {
            issues.push("unterminated single quote".to_string());
        }
        if in_double_quote {
            issues.push("unterminated double quote".to_string());
        }
        CompilationResult { passed, issues }
    }
}

#[derive(Debug, Clone)]
pub struct CompilationResult {
    pub passed: bool,
    pub issues: Vec<String>,
}
