use unicode_script::{Script, UnicodeScript};

pub struct BidiResolver;

impl BidiResolver {
    pub fn new() -> Self { Self }

    pub fn base_direction(text: &str) -> TextDirection {
        let first_strong = text.chars().find(|c| {
            let script = c.script();
            script != Script::Common && script != Script::Inherited
        });
        match first_strong {
            Some(c) if c.script() == Script::Arabic || c.script() == Script::Hebrew => TextDirection::Rtl,
            _ => TextDirection::Ltr,
        }
    }

    pub fn reorder_line(text: &str) -> String {
        let dir = Self::base_direction(text);
        match dir {
            TextDirection::Rtl => text.chars().rev().collect(),
            TextDirection::Ltr => text.to_string(),
        }
    }
}

pub enum TextDirection {
    Ltr,
    Rtl,
}
