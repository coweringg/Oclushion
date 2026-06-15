pub mod accesskit_bridge;

use crate::engine::layout::Rect;

pub struct AccessibilityNode {
    pub id: u64,
    pub role: Role,
    pub label: String,
    pub rect: Rect,
    pub enabled: bool,
    pub focused: bool,
    pub children: Vec<AccessibilityNode>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Role {
    Button,
    TextField,
    Tree,
    List,
    Tab,
    Panel,
    ScrollBar,
    StaticText,
    Image,
    Unknown,
}

impl AccessibilityNode {
    pub fn new(id: u64, role: Role, label: &str) -> Self {
        Self {
            id,
            role,
            label: label.to_string(),
            rect: Rect::ZERO,
            enabled: true,
            focused: false,
            children: vec![],
        }
    }
}
