use crate::PortId;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum PortDirection {
    Input,
    Output,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum DataType {
    Text,
    Diff,
    Bool,
    Json,
    Any,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Port {
    pub id: PortId,
    pub direction: PortDirection,
    pub data_type: DataType,
    pub label: String,
}

impl Port {
    pub fn new(id: PortId, direction: PortDirection, data_type: DataType, label: String) -> Self {
        Port { id, direction, data_type, label }
    }
}
