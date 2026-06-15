use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct TextInput {
    pub value: String,
    pub placeholder: String,
    pub rect: Rect,
    pub focused: bool,
    pub cursor_pos: usize,
}

impl TextInput {
    pub fn new(placeholder: &str) -> Self {
        Self {
            value: String::new(),
            placeholder: placeholder.to_string(),
            rect: Rect::ZERO,
            focused: false,
            cursor_pos: 0,
        }
    }
}

impl Component for TextInput {
    fn layout(&self, constraints: &Size) -> LayoutNode {
        let mut node = LayoutNode::new(0);
        node.rect = Rect::new(0.0, 0.0, constraints.width.min(400.0), 32.0);
        node
    }

    fn paint(&self, rect: &Rect, _pipeline: &mut RenderPipeline) {
        let _ = (rect, _pipeline);
    }

    fn handle_event(&mut self, _event: &winit::event::WindowEvent) -> bool {
        false
    }

    fn accessibility_info(&self) -> AccessibilityNode {
        let mut node = AccessibilityNode::new(0, Role::TextField, &self.placeholder);
        node.focused = self.focused;
        node.rect = self.rect;
        node
    }
}
