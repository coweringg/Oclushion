use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct TabBar {
    pub rect: Rect,
    pub tabs: Vec<Tab>,
    pub active_index: usize,
}

pub struct Tab {
    pub label: String,
    pub icon: Option<String>,
}

impl TabBar {
    pub fn new() -> Self {
        Self { rect: Rect::ZERO, tabs: vec![], active_index: 0 }
    }
}

impl Component for TabBar {
    fn layout(&self, constraints: &Size) -> LayoutNode {
        let mut node = LayoutNode::new(0);
        node.rect = Rect::new(0.0, 0.0, constraints.width, 36.0);
        node
    }

    fn paint(&self, rect: &Rect, _pipeline: &mut RenderPipeline) {
        let _ = (rect, _pipeline);
    }

    fn handle_event(&mut self, _event: &winit::event::WindowEvent) -> bool {
        false
    }

    fn accessibility_info(&self) -> AccessibilityNode {
        AccessibilityNode::new(0, Role::Tab, "Tab Bar")
    }
}
