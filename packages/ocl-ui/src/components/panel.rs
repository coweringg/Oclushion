use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct Panel {
    pub rect: Rect,
    pub resizable: bool,
    pub split_ratio: f32,
}

impl Panel {
    pub fn new() -> Self {
        Self { rect: Rect::ZERO, resizable: true, split_ratio: 0.5 }
    }
}

impl Component for Panel {
    fn layout(&self, constraints: &Size) -> LayoutNode {
        let mut node = LayoutNode::new(0);
        node.rect = Rect::new(0.0, 0.0, constraints.width * self.split_ratio, constraints.height);
        node
    }

    fn paint(&self, rect: &Rect, _pipeline: &mut RenderPipeline) {
        let _ = (rect, _pipeline);
    }

    fn handle_event(&mut self, _event: &winit::event::WindowEvent) -> bool {
        false
    }

    fn accessibility_info(&self) -> AccessibilityNode {
        AccessibilityNode::new(0, Role::Panel, "Panel")
    }
}
