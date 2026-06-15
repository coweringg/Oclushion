use crate::theme::{Theme, tokens::ThemeSpacing};

use fxhash::FxHashMap;
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

impl Point {
    pub const fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    pub const ZERO: Self = Self::new(0.0, 0.0);
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Size {
    pub width: f32,
    pub height: f32,
}

impl Size {
    pub const fn new(width: f32, height: f32) -> Self {
        Self { width, height }
    }

    pub const ZERO: Self = Self::new(0.0, 0.0);
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub origin: Point,
    pub size: Size,
}

impl Rect {
    pub const fn new(x: f32, y: f32, w: f32, h: f32) -> Self {
        Self { origin: Point::new(x, y), size: Size::new(w, h) }
    }

    pub const ZERO: Self = Self::new(0.0, 0.0, 0.0, 0.0);
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FlexDirection {
    Row,
    Column,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Align {
    Start,
    Center,
    End,
    Stretch,
}

#[derive(Debug, Clone)]
pub struct LayoutNode {
    pub id: u64,
    pub rect: Rect,
    pub children: Vec<LayoutNode>,
    pub direction: FlexDirection,
    pub padding: f32,
    pub gap: f32,
    pub visible: bool,
}

impl LayoutNode {
    pub fn new(id: u64) -> Self {
        Self {
            id,
            rect: Rect::ZERO,
            children: vec![],
            direction: FlexDirection::Column,
            padding: 0.0,
            gap: 0.0,
            visible: true,
        }
    }
}

pub struct LayoutEngine {
    cache: FxHashMap<u64, LayoutNode>,
    theme_spacing: ThemeSpacing,
}

impl LayoutEngine {
    pub fn new(theme: &Theme) -> Self {
        Self {
            cache: FxHashMap::default(),
            theme_spacing: theme.spacing.clone(),
        }
    }

    pub fn compute(&self, _root: &(), viewport: Size) -> LayoutNode {
        let mut root = LayoutNode::new(0);
        root.rect = Rect::new(0.0, 0.0, viewport.width, viewport.height);
        root
    }

    pub fn layout_children(&self, node: &mut LayoutNode) {
        let count = node.children.len();
        if count == 0 { return; }
        let mut cursor = match node.direction {
            FlexDirection::Column => node.rect.origin.y + node.padding,
            FlexDirection::Row => node.rect.origin.x + node.padding,
        };
        let available = match node.direction {
            FlexDirection::Column => node.rect.size.width - node.padding * 2.0,
            FlexDirection::Row => node.rect.size.height - node.padding * 2.0,
        };
        let child_size = match node.direction {
            FlexDirection::Column => node.rect.size.height / count as f32,
            FlexDirection::Row => node.rect.size.width / count as f32,
        };
        for child in &mut node.children {
            match node.direction {
                FlexDirection::Column => {
                    child.rect.origin.x = node.rect.origin.x + node.padding;
                    child.rect.origin.y = cursor;
                    child.rect.size.width = available;
                    child.rect.size.height = child_size;
                }
                FlexDirection::Row => {
                    child.rect.origin.x = cursor;
                    child.rect.origin.y = node.rect.origin.y + node.padding;
                    child.rect.size.height = available;
                    child.rect.size.width = child_size;
                }
            }
            cursor += child_size + node.gap;
        }
    }

    pub fn update_spacing(&mut self, spacing: ThemeSpacing) {
        self.theme_spacing = spacing;
    }
}
