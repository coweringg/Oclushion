use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use crate::DbError;

#[derive(Debug, Serialize, Deserialize)]
struct Manifest {
    version: u32,
}

const LATEST_VERSION: u32 = 3;

pub struct Migrations {
    path: String,
}

impl Migrations {
    pub fn new(path: &str) -> Self {
        Self {
            path: path.to_string(),
        }
    }

    fn manifest_path(&self) -> String {
        format!("{}/migration_manifest.json", self.path)
    }

    pub fn current_version(&self) -> u32 {
        let path = self.manifest_path();
        if Path::new(&path).exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(manifest) = serde_json::from_str::<Manifest>(&content) {
                    return manifest.version;
                }
            }
        }
        0
    }

    fn write_version(&self, version: u32) -> Result<(), DbError> {
        let manifest = Manifest { version };
        let content = serde_json::to_string_pretty(&manifest)?;
        if let Some(parent) = Path::new(&self.path).parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(self.manifest_path(), content)?;
        Ok(())
    }

    pub fn migrate(&self, target_version: u32) -> Result<(), DbError> {
        let current = self.current_version();
        for v in (current + 1)..=target_version {
            self.apply_migration(v)?;
        }
        self.write_version(target_version)
    }

    fn apply_migration(&self, version: u32) -> Result<(), DbError> {
        match version {
            1 => {
                let schema = super::schema::Schema::new();
                let _statements = schema.create_tables();
            }
            2 => {
                let schema = super::schema::Schema::new();
                let _indices = schema.define_indices();
            }
            3 => {}
            _ => {
                return Err(DbError::General(format!(
                    "Unknown migration version: {}",
                    version
                )))
            }
        }
        Ok(())
    }

    pub fn run_pending(&self) -> Result<(), DbError> {
        let current = self.current_version();
        if current < LATEST_VERSION {
            self.migrate(LATEST_VERSION)
        } else {
            Ok(())
        }
    }
}
