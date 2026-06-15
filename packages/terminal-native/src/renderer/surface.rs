use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_SURFACE_ID: AtomicU64 = AtomicU64::new(1);

pub struct RenderSurface {
    id: u64,
    width: u32,
    height: u32,
    scale: f64,
    pixels: Vec<u8>,
    dirty: bool,
}

impl RenderSurface {
    pub fn new(width: u32, height: u32, scale: f64) -> Result<Self, String> {
        if width == 0 || height == 0 {
            return Err("Surface dimensions must be non-zero".into());
        }
        let pixel_count = (width as u64) * (height as u64) * 4;
        if pixel_count > 268_435_456 {
            return Err(format!("Surface too large: {} pixels (max 268M)", pixel_count));
        }
        Ok(Self {
            id: NEXT_SURFACE_ID.fetch_add(1, Ordering::SeqCst),
            width,
            height,
            scale,
            pixels: vec![0u8; pixel_count as usize],
            dirty: true,
        })
    }

    pub fn id(&self) -> u64 {
        self.id
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn scale(&self) -> f64 {
        self.scale
    }

    pub fn pixels(&self) -> &[u8] {
        &self.pixels
    }

    pub fn pixels_mut(&mut self) -> &mut [u8] {
        self.dirty = true;
        &mut self.pixels
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    pub fn present(&mut self) -> Result<(), String> {
        if !self.dirty {
            return Ok(());
        }
        self.dirty = false;
        Ok(())
    }

    pub fn clear(&mut self, r: u8, g: u8, b: u8) {
        for chunk in self.pixels.chunks_exact_mut(4) {
            chunk[0] = r;
            chunk[1] = g;
            chunk[2] = b;
            chunk[3] = 255;
        }
        self.dirty = true;
    }

    pub fn write_pixel(&mut self, x: u32, y: u32, r: u8, g: u8, b: u8, a: u8) {
        if x >= self.width || y >= self.height {
            return;
        }
        let idx = ((y * self.width + x) * 4) as usize;
        let pixel = &mut self.pixels[idx..idx + 4];
        pixel[0] = r;
        pixel[1] = g;
        pixel[2] = b;
        pixel[3] = a;
        self.dirty = true;
    }
}
