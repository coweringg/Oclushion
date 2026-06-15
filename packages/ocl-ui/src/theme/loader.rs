use crate::theme::Theme;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ThemeFile {
    name: Option<String>,
    colors: Option<ThemeFileColors>,
}

#[derive(Debug, Deserialize)]
struct ThemeFileColors {
    background: Option<String>,
    foreground: Option<String>,
    accent: Option<String>,
}

pub struct ThemeLoader;

impl ThemeLoader {
    pub fn from_json(json: &str) -> Result<Theme, String> {
        let file: ThemeFile = serde_json::from_str(json)
            .map_err(|e| format!("Invalid theme JSON: {}", e))?;
        let mut theme = Theme::dark();
        if let Some(name) = file.name {
            theme.name = name;
        }
        if let Some(colors) = file.colors {
            if let Some(bg) = colors.background {
                theme.colors.bg = parse_hex(&bg)?;
            }
            if let Some(fg) = colors.foreground {
                theme.colors.text_primary = parse_hex(&fg)?;
            }
            if let Some(accent) = colors.accent {
                theme.colors.accent = parse_hex(&accent)?;
            }
        }
        Ok(theme)
    }
}

fn parse_hex(hex: &str) -> Result<[f32; 4], String> {
    let hex = hex.trim_start_matches('#');
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "Invalid hex color".to_string())?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "Invalid hex color".to_string())?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "Invalid hex color".to_string())?;
    let a = if hex.len() >= 8 {
        u8::from_str_radix(&hex[6..8], 16).map_err(|_| "Invalid hex color".to_string())?
    } else { 255 };
    Ok([r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0, a as f32 / 255.0])
}
