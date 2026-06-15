use std::collections::HashMap;
use crate::NodeId;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum DataValue {
    Text(String),
    Diff(String),
    Bool(bool),
    Json(serde_json::Value),
    Multiple(Vec<Box<DataValue>>),
    None,
}

impl DataValue {
    pub fn as_text(&self) -> Option<&str> {
        match self {
            DataValue::Text(s) => Some(s.as_str()),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            DataValue::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_json(&self) -> Option<&serde_json::Value> {
        match self {
            DataValue::Json(v) => Some(v),
            _ => None,
        }
    }

    pub fn to_string_value(&self) -> String {
        match self {
            DataValue::Text(s) => s.clone(),
            DataValue::Diff(s) => s.clone(),
            DataValue::Bool(b) => b.to_string(),
            DataValue::Json(v) => v.to_string(),
            DataValue::Multiple(items) => {
                let strs: Vec<String> = items.iter().map(|i| i.to_string_value()).collect();
                strs.join(", ")
            }
            DataValue::None => String::new(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DataFlow {
    outputs: HashMap<NodeId, DataValue>,
}

impl DataFlow {
    pub fn new() -> Self {
        DataFlow { outputs: HashMap::new() }
    }

    pub fn set_output(&mut self, node_id: NodeId, value: DataValue) {
        self.outputs.insert(node_id, value);
    }

    pub fn get_output(&self, node_id: &NodeId) -> Option<&DataValue> {
        self.outputs.get(node_id)
    }

    pub fn get_input(&self, node_id: &NodeId, dag: &crate::graph::dag::Dag) -> Option<DataValue> {
        let parents: Vec<NodeId> = dag.get_parents(node_id);
        if parents.is_empty() {
            return None;
        }
        if parents.len() == 1 {
            return self.outputs.get(&parents[0]).cloned();
        }
        let mut values = Vec::new();
        for parent in &parents {
            if let Some(val) = self.outputs.get(parent) {
                values.push(Box::new(val.clone()));
            }
        }
        if values.is_empty() {
            Some(DataValue::None)
        } else {
            Some(DataValue::Multiple(values))
        }
    }

    pub fn all_outputs(&self) -> &HashMap<NodeId, DataValue> {
        &self.outputs
    }

    pub fn clear(&mut self) {
        self.outputs.clear();
    }
}

impl Default for DataFlow {
    fn default() -> Self {
        Self::new()
    }
}
