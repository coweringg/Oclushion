use crate::{NodeId, EdgeId};
use crate::graph::dag::Dag;
use crate::graph::port::{PortDirection, DataType};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ErrorCode {
    CycleDetected,
    PortTypeMismatch,
    DisconnectedNode,
    RequiredPortNotConnected,
    InvalidConfig,
    Other,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationError {
    pub node_id: Option<NodeId>,
    pub edge_id: Option<EdgeId>,
    pub message: String,
    pub code: ErrorCode,
}

impl ValidationError {
    pub fn new(node_id: Option<NodeId>, edge_id: Option<EdgeId>, message: String, code: ErrorCode) -> Self {
        ValidationError { node_id, edge_id, message, code }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<String>,
}

pub struct ValidationEngine;

impl ValidationEngine {
    pub fn validate(dag: &Dag) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        if dag.has_cycle() {
            errors.push(ValidationError::new(
                None, None,
                "Graph contains a cycle".into(),
                ErrorCode::CycleDetected,
            ));
        }

        for edge in dag.edges.values() {
            let source_port = dag.ports.get(&edge.source_port);
            let target_port = dag.ports.get(&edge.target_port);

            if let (Some(sp), Some(tp)) = (&source_port, &target_port) {
                if sp.data_type != DataType::Any && tp.data_type != DataType::Any && sp.data_type != tp.data_type {
                    errors.push(ValidationError::new(
                        Some(edge.source_node),
                        Some(edge.id),
                        format!("Port type mismatch on edge {}: {:?} connected to {:?}",
                            edge.id, sp.data_type, tp.data_type),
                        ErrorCode::PortTypeMismatch,
                    ));
                }
            }
        }

        if dag.node_count() > 0 {
            for node_id in dag.nodes.keys() {
                let has_incoming = dag.edges.values().any(|e| &e.target_node == node_id);
                let has_outgoing = dag.edges.values().any(|e| &e.source_node == node_id);

                if dag.node_count() > 1 && !has_incoming && !has_outgoing {
                    warnings.push(format!("Node {} is disconnected (no edges)", node_id));
                    continue;
                }

                let node_ports: Vec<_> = dag.nodes.get(node_id)
                    .map(|n| n.ports.clone())
                    .unwrap_or_default();

                for port_id in &node_ports {
                    if let Some(port) = dag.ports.get(port_id) {
                        if port.direction == PortDirection::Input && dag.edge_count() > 0 {
                            let connected = dag.edges.values().any(|e| &e.target_port == port_id);
                            if !connected {
                                errors.push(ValidationError::new(
                                    Some(*node_id), None,
                                    format!("Required input port '{}' on node {} is not connected", port.label, node_id),
                                    ErrorCode::RequiredPortNotConnected,
                                ));
                            }
                        }
                    }
                }
            }
        }

        ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        }
    }
}
