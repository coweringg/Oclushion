pub mod agent_node;
pub mod condition_node;
pub mod loop_node;
pub mod parallel_node;
pub mod transform_node;
pub mod trigger_node;
pub mod approval_node;
pub mod webhook_node;

use crate::graph::node::NodeKind;
use crate::execution::data_flow::{DataFlow, DataValue};
use crate::execution::error_propagation::ExecutionError;

pub fn dispatch_execute(
    node_kind: &NodeKind,
    config: &serde_json::Value,
    inputs: &DataFlow,
) -> Result<DataValue, ExecutionError> {
    match node_kind {
        NodeKind::Agent => agent_node::AgentNode::execute(config, inputs),
        NodeKind::Condition => condition_node::ConditionNode::execute(config, inputs),
        NodeKind::Loop => loop_node::LoopNode::execute(config, inputs),
        NodeKind::Parallel => parallel_node::ForkJoinNode::execute(config, inputs),
        NodeKind::Transform => transform_node::TransformNode::execute(config, inputs),
        NodeKind::Trigger => trigger_node::TriggerNode::execute(config, inputs),
        NodeKind::Approval => approval_node::ApprovalNode::execute(config, inputs),
        NodeKind::Webhook => webhook_node::WebhookNode::execute(config, inputs),
    }
}
