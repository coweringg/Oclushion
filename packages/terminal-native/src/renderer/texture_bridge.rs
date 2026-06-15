use crate::renderer::surface::RenderSurface;

pub struct TextureBridge;

impl TextureBridge {
    pub fn new() -> Self {
        Self
    }

    pub fn share_surface(&self, _surface: &RenderSurface) -> Result<SharedSurfaceHandle, String> {
        Ok(SharedSurfaceHandle { id: _surface.id() })
    }

    pub fn present_surface(&self, _surface: &RenderSurface, _handle: &SharedSurfaceHandle) -> Result<(), String> {
        Ok(())
    }
}

pub struct SharedSurfaceHandle {
    id: u64,
}

#[cfg(target_os = "macos")]
pub struct IOSurfaceBridge;

#[cfg(target_os = "macos")]
impl IOSurfaceBridge {
    pub fn new() -> Result<Self, String> {
        Ok(Self)
    }

    pub fn create_io_surface(&self, width: u32, height: u32) -> Result<u32, String> {
        Ok(width * height)
    }
}

#[cfg(target_os = "linux")]
pub struct DmaBufBridge;

#[cfg(target_os = "linux")]
impl DmaBufBridge {
    pub fn new() -> Result<Self, String> {
        Ok(Self)
    }

    pub fn export_dma_buf(&self, _width: u32, _height: u32) -> Result<i32, String> {
        Ok(0)
    }
}

#[cfg(target_os = "windows")]
pub struct SharedHandleBridge;

#[cfg(target_os = "windows")]
impl SharedHandleBridge {
    pub fn new() -> Result<Self, String> {
        Ok(Self)
    }

    pub fn create_shared_handle(&self, _width: u32, _height: u32) -> Result<isize, String> {
        Ok(0)
    }
}
