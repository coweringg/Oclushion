use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontConfig {
    pub family: String,
    pub size: f64,
    pub weight: FontWeight,
    pub style: FontStyle,
    pub ligatures: bool,
    pub line_height: f64,
    pub letter_spacing: f64,
    pub bold_threshold: u16,
    pub builtin_box_drawing: bool,
    pub fallback_families: Vec<String>,
    pub features: HashMap<String, u32>,
}

impl Default for FontConfig {
    fn default() -> Self {
        Self {
            family: "SF Mono".into(),
            size: 13.0,
            weight: FontWeight::Regular,
            style: FontStyle::Normal,
            ligatures: true,
            line_height: 1.2,
            letter_spacing: 0.0,
            bold_threshold: 700,
            builtin_box_drawing: true,
            fallback_families: vec![
                "Fira Code".into(),
                "Cascadia Code".into(),
                "JetBrains Mono".into(),
                "monospace".into(),
            ],
            features: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FontWeight {
    Thin = 100,
    ExtraLight = 200,
    Light = 300,
    Regular = 400,
    Medium = 500,
    SemiBold = 600,
    Bold = 700,
    ExtraBold = 800,
    Black = 900,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FontStyle {
    Normal,
    Italic,
    Oblique,
}

impl FontWeight {
    pub fn from_number(n: u16) -> Self {
        match n {
            0..=150 => Self::Thin,
            151..=250 => Self::ExtraLight,
            251..=350 => Self::Light,
            351..=450 => Self::Regular,
            451..=550 => Self::Medium,
            551..=650 => Self::SemiBold,
            651..=750 => Self::Bold,
            751..=850 => Self::ExtraBold,
            _ => Self::Black,
        }
    }
}
