use crate::{Result, SandboxError, SandboxErrorKind};
use std::path::{Path, PathBuf};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

pub struct FsJail {
    project_dir: PathBuf,
    temp_dir: PathBuf,
    allowed_read_dirs: Vec<PathBuf>,
    allowed_write_dirs: Vec<PathBuf>,
}

impl FsJail {
    pub fn new(project_dir: PathBuf, temp_dir: PathBuf) -> Self {
        let mut jail = FsJail {
            project_dir: project_dir.clone(),
            temp_dir: temp_dir.clone(),
            allowed_read_dirs: Vec::new(),
            allowed_write_dirs: Vec::new(),
        };
        jail.add_read_dir(&project_dir);
        jail.add_read_write_dir(&temp_dir);
        jail
    }

    pub fn add_read_dir(&mut self, dir: &Path) {
        if !self.allowed_read_dirs.contains(&dir.to_path_buf()) {
            self.allowed_read_dirs.push(dir.to_path_buf());
        }
    }

    pub fn add_read_write_dir(&mut self, dir: &Path) {
        if !self.allowed_write_dirs.contains(&dir.to_path_buf()) {
            self.allowed_write_dirs.push(dir.to_path_buf());
        }
        if !self.allowed_read_dirs.contains(&dir.to_path_buf()) {
            self.allowed_read_dirs.push(dir.to_path_buf());
        }
    }

    pub fn configure_wasi(&self, builder: &mut WasiCtxBuilder) {
        for dir in &self.allowed_read_dirs {
            if dir.exists() {
                let dir_name = dir
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "sandbox".to_string());
                let _ = builder.preopened_dir(dir, &dir_name, DirPerms::READ, FilePerms::READ);
            }
        }
        for dir in &self.allowed_write_dirs {
            let _ = std::fs::create_dir_all(dir);
            let dir_name = dir
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "sandbox".to_string());
            let _ = builder.preopened_dir(
                dir,
                &dir_name,
                DirPerms::READ | DirPerms::MUTATE,
                FilePerms::READ | FilePerms::WRITE,
            );
        }
    }

    pub fn set_project_dir(&mut self, path: PathBuf) {
        self.project_dir = path;
    }

    pub fn is_path_allowed(&self, path: &Path, write: bool) -> bool {
        let canonical = dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());

        if write {
            self.allowed_write_dirs
                .iter()
                .any(|d| canonical.starts_with(d))
        } else {
            self.allowed_read_dirs
                .iter()
                .any(|d| canonical.starts_with(d))
        }
    }

    pub fn resolve_path(&self, path: &str) -> Result<PathBuf> {
        let p = PathBuf::from(path);

        let has_traversal = p.components().any(|c| c.as_os_str() == "..");
        if has_traversal {
            return Err(SandboxError {
                kind: SandboxErrorKind::FsAccessDenied,
                message: format!("path traversal detected: '{}'", path),
                backtrace: None,
            });
        }

        let has_root = p.has_root();
        if has_root {
            if !self.is_path_allowed(&p, false) {
                return Err(SandboxError {
                    kind: SandboxErrorKind::FsAccessDenied,
                    message: format!(
                        "access denied: path '{}' is outside allowed directories",
                        path
                    ),
                    backtrace: None,
                });
            }
            return Ok(p);
        }

        let temp_resolved = self.temp_dir.join(&p);
        if temp_resolved.exists() {
            if let Ok(canon) = dunce::canonicalize(&temp_resolved) {
                if self.is_path_allowed(&canon, false) {
                    return Ok(canon);
                }
            }
        }

        let project_resolved = self.project_dir.join(&p);
        if project_resolved.exists() {
            if let Ok(canon) = dunce::canonicalize(&project_resolved) {
                if self.is_path_allowed(&canon, false) {
                    return Ok(canon);
                }
            }
        }

        Ok(temp_resolved)
    }
}

impl Default for FsJail {
    fn default() -> Self {
        let home = if let Ok(h) = std::env::var("HOME") {
            PathBuf::from(h)
        } else if let Ok(h) = std::env::var("USERPROFILE") {
            PathBuf::from(h)
        } else {
            PathBuf::from(".")
        };
        FsJail::new(
            std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            home.join(".oclushion").join("sandbox"),
        )
    }
}
