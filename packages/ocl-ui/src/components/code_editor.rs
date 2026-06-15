use crate::engine::layout::{LayoutNode, Rect, Size};
use crate::render::pipeline::RenderPipeline;
use crate::accessibility::{AccessibilityNode, Role};
use crate::Component;

pub struct CodeEditor;

impl Component for CodeEditor {
    fn layout(&self, _c: &Size) -> LayoutNode { LayoutNode::new(0) }
    fn paint(&self, _r: &Rect, _p: &mut RenderPipeline) {}
    fn handle_event(&mut self, _e: &winit::event::WindowEvent) -> bool { false }
    fn accessibility_info(&self) -> AccessibilityNode { AccessibilityNode::new(0, Role::TextField, "Code Editor") }
}
