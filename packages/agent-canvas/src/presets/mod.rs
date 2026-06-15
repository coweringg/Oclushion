use crate::serialization::export::WorkflowDocument;
use crate::serialization::import::import_workflow;

const DEFAULT_PIPELINE: &str = include_str!("default_pipeline.json");
const SECURITY_FOCUSED: &str = include_str!("security_focused.json");
const RAPID_PROTOTYPE: &str = include_str!("rapid_prototype.json");

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PresetInfo {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
}

pub fn list_presets() -> Vec<PresetInfo> {
    vec![
        PresetInfo {
            name: "default_pipeline".to_string(),
            description: "Architect → Builder → Reviewer → QA → Docs".to_string(),
            tags: vec!["default".to_string(), "pipeline".to_string(), "full".to_string()],
        },
        PresetInfo {
            name: "security_focused".to_string(),
            description: "Architect → Builder → Security → Reviewer → QA".to_string(),
            tags: vec!["security".to_string(), "pipeline".to_string(), "review".to_string()],
        },
        PresetInfo {
            name: "rapid_prototype".to_string(),
            description: "Builder → QA (skips review)".to_string(),
            tags: vec!["rapid".to_string(), "prototype".to_string(), "minimal".to_string()],
        },
    ]
}

pub fn load_preset(name: &str) -> Result<WorkflowDocument, String> {
    let json_str = match name {
        "default_pipeline" => DEFAULT_PIPELINE,
        "security_focused" => SECURITY_FOCUSED,
        "rapid_prototype" => RAPID_PROTOTYPE,
        _ => return Err(format!("Preset '{}' not found", name)),
    };

    import_workflow(json_str, 1)
        .map_err(|e| format!("Failed to load preset '{}': {}", name, e))
}
