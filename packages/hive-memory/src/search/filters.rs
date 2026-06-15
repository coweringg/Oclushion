use crate::Insight;

#[derive(Debug, Clone)]
pub struct SearchFilters {
    pub min_confidence: Option<f32>,
    pub max_age_days: Option<i64>,
    pub exclude_project: Option<String>,
    pub tags_include: Option<Vec<String>>,
    pub agent_role: Option<String>,
}

impl SearchFilters {
    pub fn new() -> Self {
        Self {
            min_confidence: None,
            max_age_days: None,
            exclude_project: None,
            tags_include: None,
            agent_role: None,
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

    pub fn exclude_project(mut self, project: &str) -> Self {
        self.exclude_project = Some(project.to_string());
        self
    }

    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.tags_include = Some(tags);
        self
    }

    pub fn with_agent_role(mut self, role: &str) -> Self {
        self.agent_role = Some(role.to_string());
        self
    }

    pub fn apply(&self, insights: Vec<Insight>) -> Vec<Insight> {
        insights
            .into_iter()
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
                if let Some(ref exclude) = self.exclude_project {
                    if insight.source_project == *exclude {
                        return false;
                    }
                }
                if let Some(ref tags) = self.tags_include {
                    if !tags.iter().any(|t| insight.tags.contains(t)) {
                        return false;
                    }
                }
                if let Some(ref role) = self.agent_role {
                    if insight.agent_role != *role {
                        return false;
                    }
                }
                true
            })
            .collect()
    }
}
