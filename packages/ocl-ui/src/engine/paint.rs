use crate::engine::compositor::{Compositor, Layer};
use crate::theme::Theme;

pub struct PaintEngine;

impl PaintEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn prepare(&self, compositor: &Compositor, theme: &Theme) {
        for layer in compositor.layers() {
            self.paint_background(layer, theme);
            self.paint_borders(layer, theme);
        }
    }

    fn paint_background(&self, layer: &Layer, theme: &Theme) {
        let _ = (layer, theme);
    }

    fn paint_borders(&self, layer: &Layer, theme: &Theme) {
        let _ = (layer, theme);
    }
}
