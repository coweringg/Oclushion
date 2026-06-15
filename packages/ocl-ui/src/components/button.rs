use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct Button {
    pub label: String,
    pub rect: Rect,
    pub enabled: bool,
    pub hovered: bool,
    pub pressed: bool,
}

impl Button {
    pub fn new(label: &str) -> Self {
        Self {
            label: label.to_string(),
            rect: Rect::ZERO,
            enabled: true,
            hovered: false,
            pressed: false,
        }
    }
}

impl Component for Button {
    fn layout(&self, constraints: &Size) -> LayoutNode {
        let mut node = LayoutNode::new(0);
        let h = 32.0_f32.min(constraints.height);
        let w = (self.label.len() as f32 * 10.0 + 32.0).min(constraints.width);
        node.rect = Rect::new(0.0, 0.0, w, h);
        node
    }

    fn paint(&self, rect: &Rect, _pipeline: &mut RenderPipeline) {
        let _ = (rect, _pipeline);
    }

    fn handle_event(&mut self, _event: &winit::event::WindowEvent) -> bool {
        false
    }

    fn accessibility_info(&self) -> AccessibilityNode {
        let mut node = AccessibilityNode::new(0, Role::Button, &self.label);
        node.enabled = self.enabled;
        node.rect = self.rect;
        node
    }
}
