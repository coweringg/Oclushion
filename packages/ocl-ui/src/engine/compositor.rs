use crate::engine::layout::{LayoutNode, Rect};

pub struct Compositor {
    layers: Vec<Layer>,
}

pub struct Layer {
    pub rect: Rect,
    pub z_index: i32,
    pub opacity: f32,
    pub clip_rect: Option<Rect>,
}

impl Compositor {
    pub fn new() -> Self {
        Self { layers: vec![] }
    }

    pub fn compose(&mut self, root: &LayoutNode) {
        self.layers.clear();
        self.flatten_node(root, 0);
    }

    fn flatten_node(&mut self, node: &LayoutNode, depth: i32) {
        if !node.visible { return; }
        self.layers.push(Layer {
            rect: node.rect,
            z_index: depth,
            opacity: 1.0,
            clip_rect: None,
        });
        for child in &node.children {
            self.flatten_node(child, depth + 1);
        }
    }

    pub fn layers(&self) -> &[Layer] {
        &self.layers
    }

    pub fn hit_test(&self, x: f32, y: f32) -> Option<usize> {
        self.layers.iter().rposition(|layer| {
            let r = layer.rect;
            x >= r.origin.x && x <= r.origin.x + r.size.width
                && y >= r.origin.y && y <= r.origin.y + r.size.height
        })
    }
}
