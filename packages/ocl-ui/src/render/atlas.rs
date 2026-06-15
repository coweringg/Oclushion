use crate::render::pipeline::RenderPipeline;
use wgpu::Texture;

pub struct GlyphAtlas {
    texture: Option<Texture>,
    width: u32,
    height: u32,
    cursor_x: u32,
    cursor_y: u32,
    row_height: u32,
}

impl GlyphAtlas {
    pub fn new(pipeline: &RenderPipeline) -> Self {
        let texture = pipeline.device().create_texture(&wgpu::TextureDescriptor {
            label: Some("glyph-atlas"),
            size: wgpu::Extent3d { width: 2048, height: 2048, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::R8Unorm,
            usage: wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        Self {
            texture: Some(texture),
            width: 2048,
            height: 2048,
            cursor_x: 0,
            cursor_y: 0,
            row_height: 0,
        }
    }

    pub fn allocate(&mut self, width: u32, height: u32) -> Option<(u32, u32)> {
        if self.cursor_x + width > self.width {
            self.cursor_x = 0;
            self.cursor_y += self.row_height + 1;
            self.row_height = 0;
        }
        if self.cursor_y + height > self.height {
            return None;
        }
        let x = self.cursor_x;
        let y = self.cursor_y;
        self.cursor_x += width + 1;
        self.row_height = self.row_height.max(height);
        Some((x, y))
    }

    pub fn texture(&self) -> Option<&Texture> { self.texture.as_ref() }
}
