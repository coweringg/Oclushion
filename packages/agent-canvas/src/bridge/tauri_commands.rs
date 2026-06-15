use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::{NodeId, Workflow};
use crate::graph::validation::{ValidationEngine, ValidationResult};
use crate::execution::scheduler::{Scheduler, ExecutionStatus, ExecutionState};
use crate::nodes::approval_node::{ApprovalNode, ApprovalState};
use crate::serialization::export::{WorkflowDocument, to_json, to_json_pretty};
use crate::serialization::import::import_workflow;
use crate::serialization::WorkflowMetadata;
use crate::presets::{list_presets, load_preset, PresetInfo};

pub type WorkflowStore = Arc<Mutex<HashMap<NodeId, Workflow>>>;
pub type ExecutionStore = Arc<Mutex<HashMap<NodeId, ExecutionStatus>>>;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub description: String,
    pub metadata: WorkflowMetadata,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WorkflowSummary {
    pub id: NodeId,
    pub name: String,
    pub description: String,
    pub node_count: usize,
    pub edge_count: usize,
    pub version: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommandResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CommandResult<T> {
    pub fn ok(data: T) -> Self {
        CommandResult { success: true, data: Some(data), error: None }
    }

    pub fn err(msg: String) -> Self {
        CommandResult { success: false, data: None, error: Some(msg) }
    }
}

pub struct TauriCommands;

impl TauriCommands {
    pub fn create_workflow(store: &WorkflowStore, req: CreateWorkflowRequest) -> CommandResult<Workflow> {
        let mut store = store.lock().unwrap();
        let id = uuid::Uuid::new_v4();
        let now = chrono::Utc::now();

        let workflow = Workflow {
            id,
            name: req.name,
            description: req.description,
            dag: crate::graph::dag::Dag::new(),
            presets: Vec::new(),
            version: 1,
            created_at: now,
            updated_at: now,
            metadata: req.metadata,
        };

        store.insert(id, workflow.clone());
        CommandResult::ok(workflow)
    }

    pub fn get_workflow(store: &WorkflowStore, id: NodeId) -> CommandResult<Workflow> {
        let store = store.lock().unwrap();
        match store.get(&id) {
            Some(wf) => CommandResult::ok(wf.clone()),
            None => CommandResult::err(format!("Workflow {} not found", id)),
        }
    }

    pub fn update_workflow(store: &WorkflowStore, workflow: Workflow) -> CommandResult<Workflow> {
        let mut store = store.lock().unwrap();
        if !store.contains_key(&workflow.id) {
            return CommandResult::err(format!("Workflow {} not found", workflow.id));
        }
        let mut updated = workflow;
        updated.updated_at = chrono::Utc::now();
        store.insert(updated.id, updated.clone());
        CommandResult::ok(updated)
    }

    pub fn delete_workflow(store: &WorkflowStore, id: NodeId) -> CommandResult<bool> {
        let mut store = store.lock().unwrap();
        if store.remove(&id).is_some() {
            CommandResult::ok(true)
        } else {
            CommandResult::err(format!("Workflow {} not found", id))
        }
    }

    pub fn execute_workflow(
        store: &WorkflowStore,
        exec_store: &ExecutionStore,
        workflow_id: NodeId,
    ) -> CommandResult<NodeId> {
        let workflow = {
            let st = store.lock().unwrap();
            match st.get(&workflow_id) {
                Some(wf) => wf.clone(),
                None => return CommandResult::err(format!("Workflow {} not found", workflow_id)),
            }
        };

        let execution_id = uuid::Uuid::new_v4();
        let mut scheduler = Scheduler::new();

        scheduler.register_executor("Agent", |config, inputs| {
            crate::nodes::agent_node::AgentNode::execute(config, inputs)
        });
        scheduler.register_executor("Condition", |config, inputs| {
            crate::nodes::condition_node::ConditionNode::execute(config, inputs)
        });
        scheduler.register_executor("Loop", |config, inputs| {
            crate::nodes::loop_node::LoopNode::execute(config, inputs)
        });
        scheduler.register_executor("Parallel", |config, inputs| {
            crate::nodes::parallel_node::ForkJoinNode::execute(config, inputs)
        });
        scheduler.register_executor("Transform", |config, inputs| {
            crate::nodes::transform_node::TransformNode::execute(config, inputs)
        });
        scheduler.register_executor("Trigger", |config, inputs| {
            crate::nodes::trigger_node::TriggerNode::execute(config, inputs)
        });
        scheduler.register_executor("Approval", |config, inputs| {
            crate::nodes::approval_node::ApprovalNode::execute(config, inputs)
        });
        scheduler.register_executor("Webhook", |config, inputs| {
            crate::nodes::webhook_node::WebhookNode::execute(config, inputs)
        });

        let strategies = HashMap::new();
        let cancel_flag = std::sync::atomic::AtomicBool::new(false);
        let (status, _flow) = scheduler.execute(&workflow.dag, &strategies, &cancel_flag);

        let mut exec_store = exec_store.lock().unwrap();
        exec_store.insert(execution_id, status);

        CommandResult::ok(execution_id)
    }

    pub fn cancel_execution(exec_store: &ExecutionStore, execution_id: NodeId) -> CommandResult<bool> {
        let mut exec_store = exec_store.lock().unwrap();
        match exec_store.get_mut(&execution_id) {
            Some(status) => {
                status.state = ExecutionState::Cancelled;
                CommandResult::ok(true)
            }
            None => CommandResult::err(format!("Execution {} not found", execution_id)),
        }
    }

    pub fn get_execution_status(exec_store: &ExecutionStore, execution_id: NodeId) -> CommandResult<ExecutionStatus> {
        let exec_store = exec_store.lock().unwrap();
        match exec_store.get(&execution_id) {
            Some(status) => CommandResult::ok(status.clone()),
            None => CommandResult::err(format!("Execution {} not found", execution_id)),
        }
    }

    pub fn approve_node(store: &WorkflowStore, workflow_id: NodeId, node_id: NodeId, user_id: String) -> CommandResult<bool> {
        let mut store = store.lock().unwrap();
        let workflow = match store.get_mut(&workflow_id) {
            Some(wf) => wf,
            None => return CommandResult::err(format!("Workflow {} not found", workflow_id)),
        };

        match ApprovalNode::set_approval_state(&mut workflow.dag, &node_id, ApprovalState::Approved(user_id)) {
            Ok(_) => CommandResult::ok(true),
            Err(e) => CommandResult::err(format!("Failed to approve: {}", e)),
        }
    }

    pub fn reject_approval(store: &WorkflowStore, workflow_id: NodeId, node_id: NodeId, user_id: String, reason: String) -> CommandResult<bool> {
        let mut store = store.lock().unwrap();
        let workflow = match store.get_mut(&workflow_id) {
            Some(wf) => wf,
            None => return CommandResult::err(format!("Workflow {} not found", workflow_id)),
        };

        match ApprovalNode::set_approval_state(&mut workflow.dag, &node_id, ApprovalState::Rejected(user_id, reason)) {
            Ok(_) => CommandResult::ok(true),
            Err(e) => CommandResult::err(format!("Failed to reject: {}", e)),
        }
    }

    pub fn validate_workflow(store: &WorkflowStore, workflow_id: NodeId) -> CommandResult<ValidationResult> {
        let store = store.lock().unwrap();
        match store.get(&workflow_id) {
            Some(wf) => {
                let result = ValidationEngine::validate(&wf.dag);
                CommandResult::ok(result)
            }
            None => CommandResult::err(format!("Workflow {} not found", workflow_id)),
        }
    }

    pub fn import_workflow(json: &str) -> CommandResult<WorkflowDocument> {
        match import_workflow(json, 1) {
            Ok(doc) => CommandResult::ok(doc),
            Err(e) => CommandResult::err(format!("Import failed: {}", e)),
        }
    }

    pub fn export_workflow(store: &WorkflowStore, workflow_id: NodeId, pretty: bool) -> CommandResult<String> {
        let store = store.lock().unwrap();
        let workflow = match store.get(&workflow_id) {
            Some(wf) => wf,
            None => return CommandResult::err(format!("Workflow {} not found", workflow_id)),
        };

        let metadata = WorkflowMetadata::new(
            workflow.metadata.author.clone(),
            workflow.metadata.tags.clone(),
            workflow.metadata.description.clone(),
            workflow.metadata.version.clone(),
        );

        let doc = WorkflowDocument::from_dag(&workflow.dag, metadata, workflow.version);
        let result = if pretty { to_json_pretty(&doc) } else { to_json(&doc) };

        match result {
            Ok(json) => CommandResult::ok(json),
            Err(e) => CommandResult::err(format!("Export failed: {}", e)),
        }
    }

    pub fn list_presets() -> CommandResult<Vec<PresetInfo>> {
        CommandResult::ok(list_presets())
    }

    pub fn load_preset(name: &str) -> CommandResult<WorkflowDocument> {
        match load_preset(name) {
            Ok(doc) => CommandResult::ok(doc),
            Err(e) => CommandResult::err(e),
        }
    }

    pub fn get_node_types() -> CommandResult<Vec<String>> {
        CommandResult::ok(vec![
            "Agent".into(),
            "Condition".into(),
            "Loop".into(),
            "Parallel".into(),
            "Transform".into(),
            "Trigger".into(),
            "Approval".into(),
            "Webhook".into(),
        ])
    }

    pub fn get_workflow_history(store: &WorkflowStore) -> CommandResult<Vec<WorkflowSummary>> {
        let store = store.lock().unwrap();
        let summaries: Vec<WorkflowSummary> = store.values().map(|wf| {
            WorkflowSummary {
                id: wf.id,
                name: wf.name.clone(),
                description: wf.description.clone(),
                node_count: wf.dag.node_count(),
                edge_count: wf.dag.edge_count(),
                version: wf.version,
                created_at: wf.created_at,
                updated_at: wf.updated_at,
            }
        }).collect();
        CommandResult::ok(summaries)
    }
}
