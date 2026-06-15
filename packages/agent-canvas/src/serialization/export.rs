use crate::graph::dag::Dag;
use crate::graph::node::NodeKind;
use crate::serialization::WorkflowMetadata;
use crate::serialization::SerializeError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WorkflowDocument {
    pub version: u32,
    pub metadata: WorkflowMetadata,
    pub nodes: Vec<SerializableNode>,
    pub edges: Vec<SerializableEdge>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SerializableNode {
    pub id: String,
    pub node_type: String,
    pub config: serde_json::Value,
    pub position: Vec<f64>,
    pub ports: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SerializableEdge {
    pub id: String,
    pub source_node: String,
    pub source_port: String,
    pub target_node: String,
    pub target_port: String,
}

impl WorkflowDocument {
    pub fn new(
        version: u32,
        metadata: WorkflowMetadata,
        nodes: Vec<SerializableNode>,
        edges: Vec<SerializableEdge>,
    ) -> Self {
        let now = chrono::Utc::now();
        WorkflowDocument {
            version,
            metadata,
            nodes,
            edges,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn from_dag(dag: &Dag, metadata: WorkflowMetadata, version: u32) -> Self {
        let nodes: Vec<SerializableNode> = dag.nodes.values().map(|node| {
            let node_type_str = format!("{:?}", node.node_type);
            SerializableNode {
                id: node.id.to_string(),
                node_type: node_type_str,
                config: node.config.clone(),
                position: vec![node.position.0, node.position.1],
                ports: node.ports.iter().map(|p| p.to_string()).collect(),
            }
        }).collect();

        let edges: Vec<SerializableEdge> = dag.edges.values().map(|edge| {
            SerializableEdge {
                id: edge.id.to_string(),
                source_node: edge.source_node.to_string(),
                source_port: edge.source_port.to_string(),
                target_node: edge.target_node.to_string(),
                target_port: edge.target_port.to_string(),
            }
        }).collect();

        let now = chrono::Utc::now();
        WorkflowDocument {
            version,
            metadata,
            nodes,
            edges,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn to_dag(&self) -> Result<Dag, SerializeError> {
        let mut dag = Dag::new();

        for sn in &self.nodes {
            let node_id = uuid::Uuid::parse_str(&sn.id)
                .map_err(|e| SerializeError::InvalidSchema(format!("Invalid node id '{}': {}", sn.id, e)))?;

            let node_type = match sn.node_type.as_str() {
                "Agent" => NodeKind::Agent,
                "Condition" => NodeKind::Condition,
                "Loop" => NodeKind::Loop,
                "Parallel" => NodeKind::Parallel,
                "Transform" => NodeKind::Transform,
                "Trigger" => NodeKind::Trigger,
                "Approval" => NodeKind::Approval,
                "Webhook" => NodeKind::Webhook,
                other => return Err(SerializeError::InvalidSchema(format!("Unknown node type: {}", other))),
            };

            let position = if sn.position.len() >= 2 {
                (sn.position[0], sn.position[1])
            } else {
                (0.0, 0.0)
            };

            let ports: Vec<crate::PortId> = sn.ports.iter()
                .filter_map(|p| uuid::Uuid::parse_str(p).ok())
                .collect();

            let node = crate::graph::node::Node::new(node_id, node_type, sn.config.clone(), position, ports);
            dag.add_node(node);
        }

        for se in &self.edges {
            let edge_id = uuid::Uuid::parse_str(&se.id)
                .map_err(|e| SerializeError::InvalidSchema(format!("Invalid edge id '{}': {}", se.id, e)))?;
            let source_node = uuid::Uuid::parse_str(&se.source_node)
                .map_err(|e| SerializeError::InvalidSchema(format!("Invalid source_node '{}': {}", se.source_node, e)))?;
            let target_node = uuid::Uuid::parse_str(&se.target_node)
                .map_err(|e| SerializeError::InvalidSchema(format!("Invalid target_node '{}': {}", se.target_node, e)))?;
            let source_port = uuid::Uuid::parse_str(&se.source_port)
                .map_err(|e| SerializeError::InvalidSchema(format!("Invalid source_port '{}': {}", se.source_port, e)))?;
            let target_port = uuid::Uuid::parse_str(&se.target_port)
                .map_err(|e| SerializeError::InvalidSchema(format!("Invalid target_port '{}': {}", se.target_port, e)))?;

            let edge = crate::graph::edge::Edge::new(edge_id, source_node, source_port, target_node, target_port);
            dag.add_edge(edge)
                .map_err(|e| SerializeError::InvalidSchema(format!("Failed to add edge: {}", e)))?;
        }

        Ok(dag)
    }
}

pub fn to_json(document: &WorkflowDocument) -> Result<String, SerializeError> {
    serde_json::to_string(document)
        .map_err(|e| SerializeError::InvalidSchema(format!("Serialization failed: {}", e)))
}

pub fn to_json_pretty(document: &WorkflowDocument) -> Result<String, SerializeError> {
    serde_json::to_string_pretty(document)
        .map_err(|e| SerializeError::InvalidSchema(format!("Serialization failed: {}", e)))
}
