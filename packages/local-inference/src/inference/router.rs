use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RouteDecision {
    Local,
    Cloud,
}

pub struct InferenceRouter;

impl InferenceRouter {
    pub fn decide(task: &str) -> RouteDecision {
        match task {
            t if t == "autocomplete" || t == "fim" || t.starts_with("inline-") => RouteDecision::Local,
            t if t == "chat" || t == "chat-completion" => RouteDecision::Cloud,
            t if t == "agents" || t == "agent" => RouteDecision::Cloud,
            t if t == "secondary_agents" || t == "secondary-agent" => RouteDecision::Local,
            t if t.contains("embed") || t.contains("rerank") => RouteDecision::Local,
            t if t.contains("summarize") || t.contains("translate") => RouteDecision::Cloud,
            _ => RouteDecision::Cloud,
        }
    }
}
