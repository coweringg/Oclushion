use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    pub bg: [f32; 4],
    pub surface: [f32; 4],
    pub border: [f32; 4],
    pub text_primary: [f32; 4],
    pub text_secondary: [f32; 4],
    pub text_disabled: [f32; 4],
    pub accent: [f32; 4],
    pub accent_hover: [f32; 4],
    pub error: [f32; 4],
    pub warning: [f32; 4],
    pub success: [f32; 4],
    pub info: [f32; 4],
    pub scrollbar: [f32; 4],
    pub scrollbar_hover: [f32; 4],
    pub selection: [f32; 4],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSpacing {
    pub xs: f32,
    pub sm: f32,
    pub md: f32,
    pub lg: f32,
    pub xl: f32,
    pub xxl: f32,
}

impl Default for ThemeSpacing {
    fn default() -> Self {
        Self { xs: 2.0, sm: 4.0, md: 8.0, lg: 16.0, xl: 24.0, xxl: 32.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeRadii {
    pub none: f32,
    pub sm: f32,
    pub md: f32,
    pub lg: f32,
    pub full: f32,
}

impl Default for ThemeRadii {
    fn default() -> Self {
        Self { none: 0.0, sm: 4.0, md: 8.0, lg: 12.0, full: 9999.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeShadows {
    pub sm: [f32; 4],
    pub md: [f32; 4],
    pub lg: [f32; 4],
}

impl Default for ThemeShadows {
    fn default() -> Self {
        Self {
            sm: [0.0, 1.0, 2.0, 0.05],
            md: [0.0, 4.0, 8.0, 0.10],
            lg: [0.0, 8.0, 24.0, 0.15],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeTypography {
    pub font_family: String,
    pub font_mono: String,
    pub body_size: f32,
    pub h1_size: f32,
    pub h2_size: f32,
    pub h3_size: f32,
    pub small_size: f32,
    pub line_height: f32,
}

impl Default for ThemeTypography {
    fn default() -> Self {
        Self {
            font_family: "Inter, -apple-system, system-ui, sans-serif".into(),
            font_mono: "JetBrains Mono, Fira Code, monospace".into(),
            body_size: 14.0,
            h1_size: 28.0,
            h2_size: 22.0,
            h3_size: 18.0,
            small_size: 12.0,
            line_height: 1.5,
        }
    }
}

impl ThemeColors {
    pub fn dark() -> Self {
        Self {
            bg: [0.07, 0.07, 0.10, 1.0],
            surface: [0.11, 0.11, 0.15, 1.0],
            border: [0.18, 0.18, 0.24, 1.0],
            text_primary: [0.85, 0.85, 0.90, 1.0],
            text_secondary: [0.55, 0.55, 0.62, 1.0],
            text_disabled: [0.30, 0.30, 0.35, 1.0],
            accent: [0.32, 0.51, 0.95, 1.0],
            accent_hover: [0.42, 0.61, 1.0, 1.0],
            error: [0.85, 0.25, 0.30, 1.0],
            warning: [0.90, 0.68, 0.22, 1.0],
            success: [0.30, 0.75, 0.45, 1.0],
            info: [0.30, 0.65, 0.90, 1.0],
            scrollbar: [0.25, 0.25, 0.30, 0.5],
            scrollbar_hover: [0.35, 0.35, 0.40, 0.8],
            selection: [0.32, 0.51, 0.95, 0.3],
        }
    }

    pub fn light() -> Self {
        Self {
            bg: [0.97, 0.97, 0.98, 1.0],
            surface: [1.0, 1.0, 1.0, 1.0],
            border: [0.85, 0.85, 0.88, 1.0],
            text_primary: [0.10, 0.10, 0.12, 1.0],
            text_secondary: [0.40, 0.40, 0.45, 1.0],
            text_disabled: [0.70, 0.70, 0.75, 1.0],
            accent: [0.22, 0.40, 0.85, 1.0],
            accent_hover: [0.28, 0.48, 0.95, 1.0],
            error: [0.80, 0.20, 0.25, 1.0],
            warning: [0.85, 0.63, 0.15, 1.0],
            success: [0.25, 0.70, 0.40, 1.0],
            info: [0.25, 0.60, 0.85, 1.0],
            scrollbar: [0.75, 0.75, 0.80, 0.5],
            scrollbar_hover: [0.65, 0.65, 0.70, 0.8],
            selection: [0.60, 0.75, 1.0, 0.3],
        }
    }
}
