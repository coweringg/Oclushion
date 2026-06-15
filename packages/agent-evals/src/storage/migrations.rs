use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub version: usize,
    pub description: String,
    pub applied: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migrations {
    pub current_version: usize,
    pub migrations: Vec<Migration>,
}

impl Migrations {
    pub fn new() -> Self {
        Migrations {
            current_version: 0,
            migrations: vec![
                Migration {
                    version: 1,
                    description: "Initialize metrics schema".to_string(),
                    applied: false,
                },
                Migration {
                    version: 2,
                    description: "Add A/B testing support".to_string(),
                    applied: false,
                },
                Migration {
                    version: 3,
                    description: "Add prompt tuning history".to_string(),
                    applied: false,
                },
            ],
        }
    }

    pub fn run_pending(&mut self, store: &crate::storage::schema::Store) {
        let pending: Vec<Migration> = self
            .migrations
            .iter()
            .filter(|m| !m.applied)
            .cloned()
            .collect();

        for migration in &pending {
            let mut schema = store.write().expect("lock poisoned");
            match migration.version {
                1 => {
                    schema.version = 1;
                }
                2 => {
                    schema.version = 2;
                }
                3 => {
                    schema.version = 3;
                }
                _ => {}
            }
            if let Some(existing) = self
                .migrations
                .iter_mut()
                .find(|m| m.version == migration.version)
            {
                existing.applied = true;
            }
            self.current_version = migration.version;
        }
    }

    pub fn pending_count(&self) -> usize {
        self.migrations.iter().filter(|m| !m.applied).count()
    }

    pub fn applied_count(&self) -> usize {
        self.migrations.iter().filter(|m| m.applied).count()
    }

    pub fn is_fully_applied(&self) -> bool {
        self.pending_count() == 0
    }
}

impl Default for Migrations {
    fn default() -> Self {
        Self::new()
    }
}
