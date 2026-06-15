pub mod tokens;
pub mod dark;
pub mod light;
pub mod loader;

use serde::{Deserialize, Serialize};
use tokens::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub name: String,
    pub mode: ThemeMode,
    pub colors: ThemeColors,
    pub spacing: ThemeSpacing,
    pub radii: ThemeRadii,
    pub shadows: ThemeShadows,
    pub typography: ThemeTypography,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ThemeMode {
    Dark,
    Light,
}

impl Theme {
    pub fn dark() -> Self {
        Self {
            name: "Oclushion Dark".into(),
            mode: ThemeMode::Dark,
            colors: ThemeColors::dark(),
            spacing: ThemeSpacing::default(),
            radii: ThemeRadii::default(),
            shadows: ThemeShadows::default(),
            typography: ThemeTypography::default(),
        }
    }

    pub fn light() -> Self {
        Self {
            name: "Oclushion Light".into(),
            mode: ThemeMode::Light,
            colors: ThemeColors::light(),
            spacing: ThemeSpacing::default(),
            radii: ThemeRadii::default(),
            shadows: ThemeShadows::default(),
            typography: ThemeTypography::default(),
        }
    }
}
