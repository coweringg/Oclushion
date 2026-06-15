use crate::engine::state_tree::StateTree;

pub struct Reconciler;

impl Reconciler {
    pub fn new() -> Self {
        Self
    }

    pub fn reconcile(&self, _tree: &StateTree) -> Vec<ReconcileOp> {
        vec![ReconcileOp::Rebuild]
    }
}

pub enum ReconcileOp {
    Create(u64),
    Update(u64),
    Remove(u64),
    Reorder(u64, usize),
    Rebuild,
}
