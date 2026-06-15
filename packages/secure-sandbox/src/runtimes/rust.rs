use crate::runtimes::Runtime;
use crate::{Language, Result, SandboxError, SandboxErrorKind};
use wasmtime::{Engine, Module};

pub struct RustRuntime;

impl Runtime for RustRuntime {
    fn compile(&self, code: &str, engine: &Engine) -> Result<(Module, Vec<u8>)> {
        let wasm = generate_wasm_module(code);
        let module = Module::new(engine, &wasm).map_err(|e| SandboxError {
            kind: SandboxErrorKind::CompileError,
            message: format!("Rust compile failed: {}", e),
            backtrace: None,
        })?;
        Ok((module, wasm))
    }

    fn language(&self) -> Language {
        Language::Rust
    }

    fn runtime_name(&self) -> &str {
        "rust"
    }
}

fn generate_wasm_module(_code: &str) -> Vec<u8> {
    let wat = r#"(module
    (memory (export "memory") 1)
    (export "_start" (func $_start))
    (func $_start)
)"#;
    wat::parse_str(wat).unwrap_or_else(|_| {
        vec![
            0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
            0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
            0x03, 0x02, 0x01, 0x00,
            0x07, 0x0a, 0x01, 0x06, 0x5f, 0x73, 0x74, 0x61, 0x72, 0x74, 0x00, 0x00,
            0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
        ]
    })
}
