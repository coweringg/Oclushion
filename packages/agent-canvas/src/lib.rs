pub mod graph;
pub mod execution;
pub mod nodes;
pub mod serialization;
pub mod presets;
pub mod bridge;

pub use graph::dag::Dag;
pub use graph::node::{Node, NodeKind};
pub use graph::edge::Edge;
pub use graph::port::{Port, PortDirection, DataType};
pub use graph::validation::{ValidationEngine, ValidationResult, ValidationError, ErrorCode};
pub use graph::dag::GraphError;
pub use execution::data_flow::{DataFlow, DataValue};
pub use execution::error_propagation::{ExecutionError, ErrorStrategy, ErrorHandler};
pub use execution::scheduler::{Scheduler, ExecutionPlan, ExecutionStep, ExecutionStatus, ExecutionState};
pub use execution::parallel::ParallelExecutor;
pub use nodes::agent_node::{AgentRole, Model, AgentNode, AgentNodeConfig};
pub use nodes::condition_node::{ConditionOperator, ConditionNode, ConditionNodeConfig};
pub use nodes::loop_node::{LoopNode, LoopNodeConfig, LoopResult};
pub use nodes::parallel_node::{ForkJoinNode, ForkJoinNodeConfig, Branch, JoinStrategy};
pub use nodes::transform_node::{TransformType, TransformNode, TransformNodeConfig};
pub use nodes::trigger_node::{TriggerType, TriggerNode, TriggerNodeConfig};
pub use nodes::approval_node::{ApprovalNode, ApprovalNodeConfig, ApprovalState};
pub use nodes::webhook_node::{WebhookMethod, WebhookNode, WebhookNodeConfig};
pub use serialization::schema::WorkflowSchema;
pub use serialization::export::WorkflowDocument;
pub use serialization::import::import_workflow;
pub use serialization::versioning::migrate;
pub use serialization::{SerializeError, WorkflowMetadata};

pub type NodeId = uuid::Uuid;
pub type EdgeId = uuid::Uuid;
pub type PortId = uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Workflow {
    pub id: NodeId,
    pub name: String,
    pub description: String,
    pub dag: Dag,
    pub presets: Vec<String>,
    pub version: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub metadata: WorkflowMetadata,
}
