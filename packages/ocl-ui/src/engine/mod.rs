pub mod event_loop;
pub mod state_tree;
pub mod reconciler;
pub mod layout;
pub mod paint;
pub mod compositor;

use crate::animation::AnimationEngine;
use crate::theme::Theme;
use state_tree::StateTree;
use std::time::Duration;

pub struct Engine {
    pub state: StateTree,
    pub layout: layout::LayoutEngine,
    pub paint: paint::PaintEngine,
    pub compositor: compositor::Compositor,
    pub animation: AnimationEngine,
    pub theme: Theme,
    dirty: bool,
}

impl Engine {
    pub fn new() -> Self {
        let theme = Theme::dark();
        Self {
            state: StateTree::new(),
            layout: layout::LayoutEngine::new(&theme),
            paint: paint::PaintEngine::new(),
            compositor: compositor::Compositor::new(),
            animation: AnimationEngine::new(),
            theme,
            dirty: true,
        }
    }

    pub fn handle_event(&mut self, event: &winit::event::WindowEvent) {
        self.state.handle_event(event);
        self.dirty = true;
    }

    pub fn update(&mut self) {
        self.state.process_effects();
        if self.state.is_dirty() {
            self.reconcile();
            self.dirty = true;
        }
    }

    pub fn animate(&mut self, dt: f64) {
        if self.animation.update(Duration::from_secs_f64(dt)) {
            self.dirty = true;
        }
    }

    pub fn reconcile(&mut self) {
        let layout_tree = self.layout.compute(&(), self.state.viewport_size());
        self.compositor.compose(&layout_tree);
        self.paint.prepare(&self.compositor, &self.theme);
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty || self.state.is_dirty()
    }

    pub fn mark_clean(&mut self) {
        self.dirty = false;
        self.state.mark_clean();
    }

    pub fn set_viewport(&mut self, width: u32, height: u32) {
        self.state.set_viewport(width, height);
        self.dirty = true;
    }

    pub fn set_theme(&mut self, theme: Theme) {
        self.theme = theme;
        self.dirty = true;
    }
}
