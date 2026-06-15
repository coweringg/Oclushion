pub struct DarkThemeExt;

impl DarkThemeExt {
    pub const fn syntax_keyword() -> [f32; 4] { [0.78, 0.48, 0.95, 1.0] }
    pub const fn syntax_string() -> [f32; 4] { [0.62, 0.85, 0.55, 1.0] }
    pub const fn syntax_number() -> [f32; 4] { [0.90, 0.68, 0.35, 1.0] }
    pub const fn syntax_comment() -> [f32; 4] { [0.40, 0.45, 0.50, 1.0] }
    pub const fn syntax_function() -> [f32; 4] { [0.55, 0.72, 1.0, 1.0] }
    pub const fn syntax_type() -> [f32; 4] { [0.42, 0.85, 0.80, 1.0] }
}
