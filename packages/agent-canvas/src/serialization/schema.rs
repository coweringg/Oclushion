use crate::serialization::export::WorkflowDocument;

pub struct WorkflowSchema;

impl WorkflowSchema {
    pub fn validate(document: &WorkflowDocument) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if document.version == 0 {
            errors.push("Version must be greater than 0".into());
        }

        if document.nodes.is_empty() {
            errors.push("Workflow must contain at least one node".into());
        }

        for (i, node) in document.nodes.iter().enumerate() {
            if uuid::Uuid::parse_str(&node.id).is_err() {
                errors.push(format!("Node {} has invalid UUID: {}", i, node.id));
            }
        }

        for (i, edge) in document.edges.iter().enumerate() {
            if uuid::Uuid::parse_str(&edge.source_node).is_err() {
                errors.push(format!("Edge {} has invalid source_node UUID: {}", i, edge.source_node));
            }
            if uuid::Uuid::parse_str(&edge.target_node).is_err() {
                errors.push(format!("Edge {} has invalid target_node UUID: {}", i, edge.target_node));
            }

            let source_exists = document.nodes.iter().any(|n| n.id == edge.source_node);
            let target_exists = document.nodes.iter().any(|n| n.id == edge.target_node);

            if !source_exists {
                errors.push(format!("Edge {} references non-existent source node: {}", i, edge.source_node));
            }
            if !target_exists {
                errors.push(format!("Edge {} references non-existent target node: {}", i, edge.target_node));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    pub fn generate_json_schema() -> serde_json::Value {
        serde_json::json!({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": "AgentCanvas Workflow",
            "type": "object",
            "required": ["version", "nodes", "edges", "created_at", "updated_at"],
            "properties": {
                "version": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Schema version number"
                },
                "metadata": {
                    "type": "object",
                    "properties": {
                        "author": { "type": "string" },
                        "tags": { "type": "array", "items": { "type": "string" } },
                        "description": { "type": "string" },
                        "version": { "type": "string" }
                    }
                },
                "nodes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "node_type", "config", "position", "ports"],
                        "properties": {
                            "id": { "type": "string", "format": "uuid" },
                            "node_type": { "type": "string", "enum": ["Agent", "Condition", "Loop", "Parallel", "Transform", "Trigger", "Approval", "Webhook"] },
                            "config": { "type": "object" },
                            "position": {
                                "type": "array",
                                "items": { "type": "number" },
                                "minItems": 2,
                                "maxItems": 2
                            },
                            "ports": {
                                "type": "array",
                                "items": { "type": "string" }
                            }
                        }
                    }
                },
                "edges": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "source_node", "source_port", "target_node", "target_port"],
                        "properties": {
                            "id": { "type": "string", "format": "uuid" },
                            "source_node": { "type": "string", "format": "uuid" },
                            "source_port": { "type": "string", "format": "uuid" },
                            "target_node": { "type": "string", "format": "uuid" },
                            "target_port": { "type": "string", "format": "uuid" }
                        }
                    }
                },
                "created_at": { "type": "string", "format": "date-time" },
                "updated_at": { "type": "string", "format": "date-time" }
            }
        })
    }
}
