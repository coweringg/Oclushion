pub mod surface;
pub mod texture_bridge;

use crate::config::TerminalConfig;
use crate::TerminalError;

pub struct SurfaceRenderer {
    surface: surface::RenderSurface,
    config: TerminalConfig,
    frame_count: u64,
}

impl SurfaceRenderer {
    pub fn new(config: &TerminalConfig) -> Result<Self, TerminalError> {
        let surface = surface::RenderSurface::new(config.width, config.height, config.scale_factor)
            .map_err(|e| TerminalError::Renderer(e))?;
        Ok(Self {
            surface,
            config: config.clone(),
            frame_count: 0,
        })
    }

    pub fn render(&mut self) -> Result<(), TerminalError> {
        self.frame_count += 1;
        self.surface.present()
            .map_err(|e| TerminalError::Renderer(e))
    }

    pub fn resize(&mut self, width: u32, height: u32) -> Result<(), TerminalError> {
        self.surface = surface::RenderSurface::new(width, height, self.config.scale_factor)
            .map_err(|e| TerminalError::Renderer(e))?;
        Ok(())
    }

    pub fn surface_id(&self) -> u64 {
        self.surface.id()
    }

    pub fn frame_count(&self) -> u64 {
        self.frame_count
    }
}
