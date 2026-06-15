use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingsConfig {
    pub bindings: Vec<Keybinding>,
}

impl Default for KeybindingsConfig {
    fn default() -> Self {
        Self {
            bindings: vec![
                Keybinding { keys: "ctrl+c".into(), action: KeyAction::Copy },
                Keybinding { keys: "ctrl+v".into(), action: KeyAction::Paste },
                Keybinding { keys: "ctrl+shift+c".into(), action: KeyAction::Copy },
                Keybinding { keys: "ctrl+shift+v".into(), action: KeyAction::Paste },
                Keybinding { keys: "ctrl+plus".into(), action: KeyAction::IncreaseFontSize },
                Keybinding { keys: "ctrl+minus".into(), action: KeyAction::DecreaseFontSize },
                Keybinding { keys: "ctrl+0".into(), action: KeyAction::ResetFontSize },
                Keybinding { keys: "ctrl+shift+enter".into(), action: KeyAction::ToggleFullscreen },
                Keybinding { keys: "alt+enter".into(), action: KeyAction::ToggleFullscreen },
                Keybinding { keys: "f11".into(), action: KeyAction::ToggleFullscreen },
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Keybinding {
    pub keys: String,
    pub action: KeyAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KeyAction {
    Copy,
    Paste,
    IncreaseFontSize,
    DecreaseFontSize,
    ResetFontSize,
    ToggleFullscreen,
    CloseTerminal,
    NewTab,
    NextTab,
    PreviousTab,
    ScrollUp,
    ScrollDown,
    ScrollPageUp,
    ScrollPageDown,
    ScrollToTop,
    ScrollToBottom,
    ClearScreen,
    Search,
    WriteText(String),
    SendSignal(String),
}

impl KeybindingsConfig {
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| format!("Invalid keybindings config: {}", e))
    }

    pub fn resolve(&self, key_combo: &str) -> Option<&KeyAction> {
        self.bindings
            .iter()
            .find(|b| b.keys == key_combo)
            .map(|b| &b.action)
    }
}
