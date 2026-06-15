use cosmic_text::FontSystem;

pub struct FontManager {
    font_system: FontSystem,
}

impl FontManager {
    pub fn new() -> Self {
        Self { font_system: FontSystem::new() }
    }

    pub fn resolve_font(&mut self, family: &str) -> cosmic_text::Family<'static> {
        let name = family.to_string().into_boxed_str();
        let name_ref: &'static str = Box::leak(name);
        let families = &[cosmic_text::Family::Name(name_ref), cosmic_text::Family::SansSerif];
        let id = self.font_system.db_mut().query(&cosmic_text::fontdb::Query {
            families,
            ..Default::default()
        });
        if id.is_some() {
            return cosmic_text::Family::Name(name_ref);
        }
        cosmic_text::Family::SansSerif
    }

    pub fn font_system(&mut self) -> &mut FontSystem {
        &mut self.font_system
    }
}
