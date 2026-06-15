use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorScheme {
    pub name: String,
    pub foreground: [u8; 4],
    pub background: [u8; 4],
    pub cursor: [u8; 4],
    pub cursor_text: [u8; 4],
    pub selection_bg: [u8; 4],
    pub selection_fg: [u8; 4],
    pub black: [u8; 4],
    pub red: [u8; 4],
    pub green: [u8; 4],
    pub yellow: [u8; 4],
    pub blue: [u8; 4],
    pub magenta: [u8; 4],
    pub cyan: [u8; 4],
    pub white: [u8; 4],
    pub bright_black: [u8; 4],
    pub bright_red: [u8; 4],
    pub bright_green: [u8; 4],
    pub bright_yellow: [u8; 4],
    pub bright_blue: [u8; 4],
    pub bright_magenta: [u8; 4],
    pub bright_cyan: [u8; 4],
    pub bright_white: [u8; 4],
}

impl Default for ColorScheme {
    fn default() -> Self {
        Self {
            name: "default".into(),
            foreground: [0xd8, 0xde, 0xe9, 0xff],
            background: [0x2e, 0x34, 0x40, 0xff],
            cursor: [0xd8, 0xde, 0xe9, 0xff],
            cursor_text: [0x2e, 0x34, 0x40, 0xff],
            selection_bg: [0x4c, 0x56, 0x6a, 0xff],
            selection_fg: [0xd8, 0xde, 0xe9, 0xff],
            black: [0x3b, 0x42, 0x52, 0xff],
            red: [0xbf, 0x61, 0x6a, 0xff],
            green: [0xa3, 0xbe, 0x8c, 0xff],
            yellow: [0xeb, 0xcb, 0x8b, 0xff],
            blue: [0x81, 0xa1, 0xc1, 0xff],
            magenta: [0xb4, 0x8e, 0xad, 0xff],
            cyan: [0x88, 0xc0, 0xd0, 0xff],
            white: [0xc5, 0xcb, 0xd7, 0xff],
            bright_black: [0x4c, 0x56, 0x6a, 0xff],
            bright_red: [0xd0, 0x87, 0x70, 0xff],
            bright_green: [0xa3, 0xbe, 0x8c, 0xff],
            bright_yellow: [0xeb, 0xcb, 0x8b, 0xff],
            bright_blue: [0x81, 0xa1, 0xc1, 0xff],
            bright_magenta: [0xb4, 0x8e, 0xad, 0xff],
            bright_cyan: [0x88, 0xc0, 0xd0, 0xff],
            bright_white: [0xe5, 0xe9, 0xf0, 0xff],
        }
    }
}

const SCHEMES: &[(&str, &str)] = &[
    ("nord", r#"{"name":"nord","foreground":[216,222,233,255],"background":[46,52,64,255]}"#),
    ("dracula", r#"{"name":"dracula","foreground":[248,248,242,255],"background":[40,42,54,255]}"#),
    ("solarized-dark", r#"{"name":"solarized-dark","foreground":[147,161,161,255],"background":[0,43,54,255]}"#),
    ("solarized-light", r#"{"name":"solarized-light","foreground":[101,123,131,255],"background":[253,246,227,255]}"#),
    ("gruvbox-dark", r#"{"name":"gruvbox-dark","foreground":[235,219,178,255],"background":[40,40,40,255]}"#),
    ("one-half-dark", r#"{"name":"one-half-dark","foreground":[220,223,228,255],"background":[40,44,52,255]}"#),
];

impl ColorScheme {
    pub fn named(name: &str) -> Option<Self> {
        let name_lower = name.to_lowercase();
        SCHEMES.iter().find(|(key, _)| *key == name_lower).map(|(_, json)| {
            serde_json::from_str(json).unwrap_or_default()
        })
    }

    pub fn all_names() -> Vec<&'static str> {
        SCHEMES.iter().map(|(name, _)| *name).collect()
    }
}
