pub mod engine;
pub mod render;
pub mod components;
pub mod text;
pub mod theme;
pub mod animation;
pub mod accessibility;
pub mod platform;

mod app;
mod window;

pub use app::App;
pub use engine::layout::LayoutEngine;
pub use render::pipeline::RenderPipeline;
pub use theme::{Theme, ThemeMode, tokens::ThemeSpacing};
pub use engine::state_tree::{StateTree, Signal, Effect};
pub use engine::layout::{LayoutNode, Size, Point, Rect};
pub use window::run_app;

#[derive(Debug, thiserror::Error)]
pub enum UiError {
    #[error("Render error: {0}")]
    Render(String),
    #[error("Layout error: {0}")]
    Layout(String),
    #[error("Window error: {0}")]
    Window(String),
    #[error("Font error: {0}")]
    Font(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, UiError>;

pub trait Component {
    fn layout(&self, constraints: &Size) -> LayoutNode;
    fn paint(&self, rect: &Rect, pipeline: &mut RenderPipeline);
    fn handle_event(&mut self, event: &winit::event::WindowEvent) -> bool;
    fn accessibility_info(&self) -> accessibility::AccessibilityNode;
}
