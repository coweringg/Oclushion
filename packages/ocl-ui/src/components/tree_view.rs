use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct TreeView {
    pub rect: Rect,
    pub items: Vec<TreeItem>,
}

pub struct TreeItem {
    pub label: String,
    pub expanded: bool,
    pub depth: u32,
    pub children: Vec<TreeItem>,
}

impl TreeView {
    pub fn new() -> Self {
        Self { rect: Rect::ZERO, items: vec![] }
    }
}

impl Component for TreeView {
    fn layout(&self, constraints: &Size) -> LayoutNode {
        let mut node = LayoutNode::new(0);
        node.rect = Rect::new(0.0, 0.0, constraints.width, constraints.height);
        node
    }

    fn paint(&self, rect: &Rect, _pipeline: &mut RenderPipeline) {
        let _ = (rect, _pipeline);
    }

    fn handle_event(&mut self, _event: &winit::event::WindowEvent) -> bool {
        false
    }

    fn accessibility_info(&self) -> AccessibilityNode {
        AccessibilityNode::new(0, Role::Tree, "File Tree")
    }
}
