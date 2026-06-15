use crate::NodeId;
use crate::PortId;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum NodeKind {
    Agent,
    Condition,
    Loop,
    Parallel,
    Transform,
    Trigger,
    Approval,
    Webhook,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Node {
    pub id: NodeId,
    pub node_type: NodeKind,
    pub config: serde_json::Value,
    pub position: (f64, f64),
    pub ports: Vec<PortId>,
}

impl Node {
    pub fn new(id: NodeId, node_type: NodeKind, config: serde_json::Value, position: (f64, f64), ports: Vec<PortId>) -> Self {
        Node { id, node_type, config, position, ports }
    }
}

pub trait NodeConfig: serde::Serialize + serde::de::DeserializeOwned {
    fn node_kind() -> NodeKind;
}
