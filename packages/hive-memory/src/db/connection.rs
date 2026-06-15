use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;
use crate::{DbError, Insight};

pub struct QueryBuilder {
    db: Arc<RwLock<HashMap<Uuid, Insight>>>,
    min_confidence: Option<f32>,
    max_age_days: Option<i64>,
    tags_include: Option<Vec<String>>,
    agent_role: Option<String>,
    source_project: Option<String>,
    author: Option<String>,
    limit: Option<usize>,
}

impl QueryBuilder {
    fn new(db: Arc<RwLock<HashMap<Uuid, Insight>>>) -> Self {
        Self {
            db,
            min_confidence: None,
            max_age_days: None,
            tags_include: None,
            agent_role: None,
            source_project: None,
            author: None,
            limit: None,
        }
    }

    pub fn with_min_confidence(mut self, confidence: f32) -> Self {
        self.min_confidence = Some(confidence);
        self
    }

    pub fn with_max_age_days(mut self, days: i64) -> Self {
        self.max_age_days = Some(days);
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags_include = Some(tags);
        self
    }

    pub fn with_agent_role(mut self, role: String) -> Self {
        self.agent_role = Some(role);
        self
    }

    pub fn with_source_project(mut self, project: String) -> Self {
        self.source_project = Some(project);
        self
    }

    pub fn with_author(mut self, author: String) -> Self {
        self.author = Some(author);
        self
    }

    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    pub fn execute(&self) -> Vec<Insight> {
        let store = self.db.read().unwrap();
        let mut results: Vec<Insight> = store
            .values()
            .filter(|insight| {
                if let Some(min_conf) = self.min_confidence {
                    if insight.confidence < min_conf {
                        return false;
                    }
                }
                if let Some(max_days) = self.max_age_days {
                    let cutoff = chrono::Utc::now() - chrono::Duration::days(max_days);
                    if insight.created_at < cutoff {
                        return false;
                    }
                }
                if let Some(ref tags) = self.tags_include {
                    if !tags.iter().any(|t| insight.tags.contains(t)) {
                        return false;
                    }
                }
                if let Some(ref role) = self.agent_role {
                    if &insight.agent_role != role {
                        return false;
                    }
                }
                if let Some(ref project) = self.source_project {
                    if &insight.source_project != project {
                        return false;
                    }
                }
                if let Some(ref a) = self.author {
                    if &insight.author != a {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();

        results.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        if let Some(limit) = self.limit {
            results.truncate(limit);
        }

        results
    }
}

pub struct Database {
    store: Arc<RwLock<HashMap<Uuid, Insight>>>,
}

impl Database {
    pub fn new(_path: &str) -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn open(path: &str) -> Result<Self, DbError> {
        Ok(Self::new(path))
    }

    pub fn close(&self) {}

    pub fn insert(&self, insight: Insight) -> Result<(), DbError> {
        let mut store = self.store.write().map_err(|e| DbError::General(e.to_string()))?;
        store.insert(insight.id, insight);
        Ok(())
    }

    pub fn batch_insert(&self, insights: Vec<Insight>) -> Result<(), DbError> {
        let mut store = self.store.write().map_err(|e| DbError::General(e.to_string()))?;
        for insight in insights {
            store.insert(insight.id, insight);
        }
        Ok(())
    }

    pub fn delete(&self, id: Uuid) -> Result<(), DbError> {
        let mut store = self.store.write().map_err(|e| DbError::General(e.to_string()))?;
        store.remove(&id);
        Ok(())
    }

    pub fn get(&self, id: Uuid) -> Option<Insight> {
        let store = self.store.read().ok()?;
        store.get(&id).cloned()
    }

    pub fn query(&self) -> QueryBuilder {
        QueryBuilder::new(self.store.clone())
    }

    pub fn all_insights(&self) -> Vec<Insight> {
        let store = self.store.read().unwrap();
        store.values().cloned().collect()
    }

    pub fn insight_count(&self) -> usize {
        let store = self.store.read().unwrap();
        store.len()
    }
}
