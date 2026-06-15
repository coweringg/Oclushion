use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct ScrollView {
    pub content_height: f32,
    pub scroll_y: f32,
    pub rect: Rect,
    pub children: Vec<Box<dyn Component>>,
}

impl ScrollView {
    pub fn new() -> Self {
        Self { content_height: 0.0, scroll_y: 0.0, rect: Rect::ZERO, children: vec![] }
    }

    pub fn scroll_to(&mut self, y: f32) {
        let max_scroll = (self.content_height - self.rect.size.height).max(0.0);
        self.scroll_y = y.clamp(0.0, max_scroll);
    }
}

impl Component for ScrollView {
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
        AccessibilityNode::new(0, Role::List, "ScrollView")
    }
}
