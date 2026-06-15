use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schema {
    pub version: u32,
    pub table_name: String,
}

impl Schema {
    pub fn new() -> Self {
        Self {
            version: 1,
            table_name: String::from("insights"),
        }
    }

    pub fn create_tables(&self) -> Vec<String> {
        vec![
            format!(
                "CREATE TABLE IF NOT EXISTS {} (id TEXT PRIMARY KEY, vector BLOB, text TEXT, source_project TEXT, author TEXT, confidence REAL, tags TEXT, created_at TEXT, expires_at TEXT, agent_role TEXT, outcome TEXT)",
                self.table_name
            ),
        ]
    }

    pub fn define_indices(&self) -> Vec<String> {
        vec![
            format!("CREATE INDEX IF NOT EXISTS idx_{}_source_project ON {}(source_project)", self.table_name, self.table_name),
            format!("CREATE INDEX IF NOT EXISTS idx_{}_confidence ON {}(confidence)", self.table_name, self.table_name),
            format!("CREATE INDEX IF NOT EXISTS idx_{}_created_at ON {}(created_at)", self.table_name, self.table_name),
            format!("CREATE INDEX IF NOT EXISTS idx_{}_agent_role ON {}(agent_role)", self.table_name, self.table_name),
        ]
    }
}
