mod javascript;
mod python;
mod rust;

pub use javascript::JavaScriptRuntime;
pub use python::PythonRuntime;
pub use rust::RustRuntime;

use crate::{Language, Result};
use wasmtime::{Engine, Module};

pub trait Runtime: Send + Sync {
    fn compile(&self, code: &str, engine: &Engine) -> Result<(Module, Vec<u8>)>;
    fn language(&self) -> Language;
    fn runtime_name(&self) -> &str;
}

pub fn get_runtime(language: Language) -> Result<Box<dyn Runtime>> {
    match language {
        Language::JavaScript => Ok(Box::new(JavaScriptRuntime)),
        Language::Python => Ok(Box::new(PythonRuntime)),
        Language::Rust => Ok(Box::new(RustRuntime)),
    }
}
