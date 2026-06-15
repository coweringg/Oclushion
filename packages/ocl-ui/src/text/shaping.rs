use cosmic_text::{Attrs, FontSystem, Shaping, SwashCache};

pub struct TextShaper {
    font_system: FontSystem,
    swash_cache: SwashCache,
}

impl TextShaper {
    pub fn new() -> Self {
        let font_system = FontSystem::new();
        let swash_cache = SwashCache::new();
        Self { font_system, swash_cache }
    }

    pub fn shape(&mut self, text: &str, size: f32) -> Vec<PositionedGlyph> {
        let mut buffer = cosmic_text::Buffer::new(&mut self.font_system, cosmic_text::Metrics::new(size, size * 1.2));
        buffer.set_text(&mut self.font_system, text, Attrs::new(), Shaping::Advanced);
        buffer.shape_until_scroll(&mut self.font_system, true);
        let mut glyphs = vec![];
        for run in buffer.layout_runs() {
            for glyph in run.glyphs.iter() {
                glyphs.push(PositionedGlyph {
                    glyph_id: glyph.glyph_id,
                    x: glyph.x,
                    y: glyph.y,
                    w: glyph.w,
                    font_size: glyph.font_size,
                });
            }
        }
        glyphs
    }

    pub fn font_system(&mut self) -> &mut FontSystem { &mut self.font_system }
    pub fn swash_cache(&mut self) -> &mut SwashCache { &mut self.swash_cache }
}

pub struct PositionedGlyph {
    pub glyph_id: u16,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub font_size: f32,
}
