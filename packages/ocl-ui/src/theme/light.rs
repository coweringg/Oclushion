pub struct LightThemeExt;

impl LightThemeExt {
    pub const fn syntax_keyword() -> [f32; 4] { [0.50, 0.20, 0.75, 1.0] }
    pub const fn syntax_string() -> [f32; 4] { [0.35, 0.65, 0.25, 1.0] }
    pub const fn syntax_number() -> [f32; 4] { [0.80, 0.50, 0.15, 1.0] }
    pub const fn syntax_comment() -> [f32; 4] { [0.55, 0.58, 0.62, 1.0] }
    pub const fn syntax_function() -> [f32; 4] { [0.20, 0.40, 0.85, 1.0] }
    pub const fn syntax_type() -> [f32; 4] { [0.15, 0.65, 0.60, 1.0] }
}
