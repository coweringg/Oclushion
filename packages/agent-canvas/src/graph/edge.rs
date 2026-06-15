use crate::{NodeId, EdgeId, PortId};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Edge {
    pub id: EdgeId,
    pub source_node: NodeId,
    pub source_port: PortId,
    pub target_node: NodeId,
    pub target_port: PortId,
}

impl Edge {
    pub fn new(id: EdgeId, source_node: NodeId, source_port: PortId, target_node: NodeId, target_port: PortId) -> Self {
        Edge { id, source_node, source_port, target_node, target_port }
    }
}
