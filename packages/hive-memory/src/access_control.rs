use std::collections::HashSet;
use crate::Insight;

pub struct AccessControl {
    private_projects: HashSet<String>,
}

impl AccessControl {
    pub fn new() -> Self {
        Self {
            private_projects: HashSet::new(),
        }
    }

    pub fn can_read(&self, project: &str, insight: &Insight) -> bool {
        if self.private_projects.contains(project) {
            return insight.source_project == project;
        }
        if self.private_projects.contains(&insight.source_project) {
            return insight.source_project == project;
        }
        true
    }

    pub fn can_write(&self, _project: &str) -> bool {
        true
    }

    pub fn set_project_visibility(&mut self, project: &str, private: bool) {
        if private {
            self.private_projects.insert(project.to_string());
        } else {
            self.private_projects.remove(project);
        }
    }

    pub fn is_project_private(&self, project: &str) -> bool {
        self.private_projects.contains(project)
    }
}
