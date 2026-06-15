pub mod colors;
pub mod font;
pub mod keybindings;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
    pub font_family: String,
    pub font_size: f64,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub scrollback_lines: u32,
    pub cursor_style: CursorStyle,
    pub cursor_blink: bool,
    pub color_scheme: String,
    pub shell_args: Vec<String>,
    pub environment: Vec<(String, String)>,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        Self {
            font_family: "SF Mono, Fira Code, Cascadia Code, monospace".into(),
            font_size: 13.0,
            width: 800,
            height: 600,
            scale_factor: 1.0,
            scrollback_lines: 10_000,
            cursor_style: CursorStyle::Block,
            cursor_blink: true,
            color_scheme: "default".into(),
            shell_args: vec![],
            environment: vec![],
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CursorStyle {
    Block,
    Underline,
    Bar,
}

impl TerminalConfig {
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| format!("Invalid terminal config: {}", e))
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    pub fn with_font(mut self, family: &str, size: f64) -> Self {
        self.font_family = family.to_string();
        self.font_size = size;
        self
    }

    pub fn with_size(mut self, width: u32, height: u32) -> Self {
        self.width = width;
        self.height = height;
        self
    }

    pub fn with_scrollback(mut self, lines: u32) -> Self {
        self.scrollback_lines = lines.min(100_000);
        self
    }
}
