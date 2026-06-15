use crate::NodeId;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ExecutionError {
    NodeFailure { node_id: NodeId, message: String },
    MaxIterationsReached { node_id: NodeId, max: u32 },
    ApprovalTimeout { node_id: NodeId },
    Cancelled,
    Aborted(String),
}

impl std::fmt::Display for ExecutionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExecutionError::NodeFailure { node_id, message } => {
                write!(f, "Node {} failed: {}", node_id, message)
            }
            ExecutionError::MaxIterationsReached { node_id, max } => {
                write!(f, "Node {} reached max iterations ({})", node_id, max)
            }
            ExecutionError::ApprovalTimeout { node_id } => {
                write!(f, "Approval node {} timed out", node_id)
            }
            ExecutionError::Cancelled => write!(f, "Execution cancelled"),
            ExecutionError::Aborted(msg) => write!(f, "Execution aborted: {}", msg),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ErrorStrategy {
    Retry(u32),
    Skip,
    Abort,
    Fallback(NodeId),
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ErrorHandlerResult {
    pub handled: bool,
    pub strategy_used: ErrorStrategy,
    pub error: ExecutionError,
}

pub struct ErrorHandler;

impl ErrorHandler {
    pub fn handle(node_id: NodeId, error: ExecutionError, strategy: &ErrorStrategy, attempt: u32) -> ErrorHandlerResult {
        match strategy {
            ErrorStrategy::Retry(max_retries) => {
                if attempt < *max_retries {
                    ErrorHandlerResult {
                        handled: true,
                        strategy_used: strategy.clone(),
                        error,
                    }
                } else {
                    ErrorHandlerResult {
                        handled: false,
                        strategy_used: strategy.clone(),
                        error: ExecutionError::NodeFailure {
                            node_id,
                            message: format!("Failed after {} retries", max_retries),
                        },
                    }
                }
            }
            ErrorStrategy::Skip => {
                ErrorHandlerResult {
                    handled: true,
                    strategy_used: strategy.clone(),
                    error,
                }
            }
            ErrorStrategy::Abort => {
                ErrorHandlerResult {
                    handled: false,
                    strategy_used: strategy.clone(),
                    error,
                }
            }
            ErrorStrategy::Fallback(_fallback_node) => {
                ErrorHandlerResult {
                    handled: true,
                    strategy_used: strategy.clone(),
                    error,
                }
            }
        }
    }

    pub fn backoff_delay(attempt: u32) -> std::time::Duration {
        let base_ms = 100u64;
        let delay = base_ms * 2u64.pow(attempt);
        std::time::Duration::from_millis(delay.min(10_000))
    }
}
