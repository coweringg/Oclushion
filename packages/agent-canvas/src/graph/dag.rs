use std::collections::{HashMap, VecDeque};
use std::fmt;
use crate::{NodeId, EdgeId, PortId};
use crate::graph::node::Node;
use crate::graph::edge::Edge;
use crate::graph::port::Port;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum GraphError {
    CycleDetected,
    NodeNotFound(NodeId),
    EdgeNotFound(EdgeId),
    PortNotFound(PortId),
    PortMismatch { edge_id: EdgeId, source_type: String, target_type: String },
    InvalidTopology(String),
}

impl fmt::Display for GraphError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GraphError::CycleDetected => write!(f, "Cycle detected in graph"),
            GraphError::NodeNotFound(id) => write!(f, "Node not found: {}", id),
            GraphError::EdgeNotFound(id) => write!(f, "Edge not found: {}", id),
            GraphError::PortNotFound(id) => write!(f, "Port not found: {}", id),
            GraphError::PortMismatch { edge_id, source_type, target_type } => {
                write!(f, "Port type mismatch on edge {}: {} != {}", edge_id, source_type, target_type)
            }
            GraphError::InvalidTopology(msg) => write!(f, "Invalid topology: {}", msg),
        }
    }
}

impl std::error::Error for GraphError {}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Dag {
    pub adjacency: HashMap<NodeId, Vec<(NodeId, EdgeId)>>,
    pub nodes: HashMap<NodeId, Node>,
    pub edges: HashMap<EdgeId, Edge>,
    pub ports: HashMap<PortId, Port>,
}

impl Dag {
    pub fn new() -> Self {
        Dag {
            adjacency: HashMap::new(),
            nodes: HashMap::new(),
            edges: HashMap::new(),
            ports: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, node: Node) {
        let id = node.id;
        self.adjacency.entry(id).or_default();
        self.nodes.insert(id, node);
    }

    pub fn add_port(&mut self, port: Port) {
        self.ports.insert(port.id, port);
    }

    pub fn get_port(&self, id: &PortId) -> Option<&Port> {
        self.ports.get(id)
    }

    pub fn remove_node(&mut self, id: NodeId) -> Result<(), GraphError> {
        if !self.nodes.contains_key(&id) {
            return Err(GraphError::NodeNotFound(id));
        }
        let node = self.nodes.get(&id).unwrap();
        for port_id in &node.ports {
            self.ports.remove(port_id);
        }
        self.adjacency.remove(&id);
        for edges in self.adjacency.values_mut() {
            edges.retain(|(target, _)| *target != id);
        }
        self.edges.retain(|_, e| e.source_node != id && e.target_node != id);
        self.nodes.remove(&id);
        Ok(())
    }

    pub fn add_edge(&mut self, edge: Edge) -> Result<(), GraphError> {
        if !self.nodes.contains_key(&edge.source_node) {
            return Err(GraphError::NodeNotFound(edge.source_node));
        }
        if !self.nodes.contains_key(&edge.target_node) {
            return Err(GraphError::NodeNotFound(edge.target_node));
        }
        if self.edges.contains_key(&edge.id) {
            return Err(GraphError::InvalidTopology("Edge id already exists".into()));
        }
        self.adjacency.entry(edge.source_node).or_default().push((edge.target_node, edge.id));
        self.edges.insert(edge.id, edge);
        Ok(())
    }

    pub fn remove_edge(&mut self, id: EdgeId) -> Result<(), GraphError> {
        if !self.edges.contains_key(&id) {
            return Err(GraphError::EdgeNotFound(id));
        }
        for edges in self.adjacency.values_mut() {
            edges.retain(|(_, eid)| *eid != id);
        }
        self.edges.remove(&id);
        Ok(())
    }

    pub fn get_node(&self, id: &NodeId) -> Option<&Node> {
        self.nodes.get(id)
    }

    pub fn get_node_mut(&mut self, id: &NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(id)
    }

    pub fn get_edge(&self, id: &EdgeId) -> Option<&Edge> {
        self.edges.get(id)
    }

    pub fn get_children(&self, id: &NodeId) -> Vec<&NodeId> {
        self.adjacency.get(id).map(|edges| {
            edges.iter().map(|(child, _)| child).collect()
        }).unwrap_or_default()
    }

    pub fn get_parents(&self, id: &NodeId) -> Vec<NodeId> {
        self.adjacency.iter()
            .filter(|(_, edges)| edges.iter().any(|(child, _)| child == id))
            .map(|(parent, _)| *parent)
            .collect()
    }

    pub fn topological_sort(&self) -> Result<Vec<NodeId>, GraphError> {
        let mut in_degree: HashMap<NodeId, usize> = HashMap::new();
        for node_id in self.nodes.keys() {
            in_degree.entry(*node_id).or_insert(0);
        }
        for edges in self.adjacency.values() {
            for (target, _) in edges {
                *in_degree.entry(*target).or_insert(0) += 1;
            }
        }
        let mut queue: VecDeque<NodeId> = VecDeque::new();
        for (node_id, degree) in &in_degree {
            if *degree == 0 {
                queue.push_back(*node_id);
            }
        }
        let mut result = Vec::new();
        while let Some(node_id) = queue.pop_front() {
            result.push(node_id);
            if let Some(children) = self.adjacency.get(&node_id) {
                for (child, _) in children {
                    if let Some(degree) = in_degree.get_mut(child) {
                        *degree -= 1;
                        if *degree == 0 {
                            queue.push_back(*child);
                        }
                    }
                }
            }
        }
        if result.len() != self.nodes.len() {
            return Err(GraphError::CycleDetected);
        }
        Ok(result)
    }

    pub fn has_cycle(&self) -> bool {
        self.topological_sort().is_err()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn edge_count(&self) -> usize {
        self.edges.len()
    }
}

impl Default for Dag {
    fn default() -> Self {
        Self::new()
    }
}
