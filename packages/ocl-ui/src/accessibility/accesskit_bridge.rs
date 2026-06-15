use crate::accessibility::{AccessibilityNode, Role};
use accesskit::Role as AkRole;

pub struct AccessKitBridge;

impl AccessKitBridge {
    pub fn new() -> Self { Self }

    pub fn build_tree(&self, root: &AccessibilityNode) -> accesskit::Node {
        let role = Self::map_role(root.role);
        let mut builder = accesskit::NodeBuilder::new(role);
        builder.set_children(
            root.children.iter().map(|c| accesskit::NodeId::from(c.id)).collect::<Vec<_>>()
        );
        builder.build()
    }

    fn map_role(role: Role) -> AkRole {
        match role {
            Role::Button => AkRole::Button,
            Role::TextField => AkRole::TextInput,
            Role::Tree => AkRole::Tree,
            Role::List => AkRole::List,
            Role::Tab => AkRole::Tab,
            Role::Panel => AkRole::Pane,
            Role::ScrollBar => AkRole::ScrollBar,
            Role::StaticText => AkRole::StaticText,
            Role::Image => AkRole::Image,
            Role::Unknown => AkRole::Unknown,
        }
    }
}
