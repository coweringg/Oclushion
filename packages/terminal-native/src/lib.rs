pub mod config;
pub mod ffi;
pub mod io;
pub mod pty;
pub mod renderer;

mod clipboard;
mod health;
mod resize;

pub use clipboard::ClipboardBridge;
pub use health::TerminalHealth;
pub use resize::ResizeHandle;

use std::sync::{Arc, Mutex};

pub struct TerminalInstance {
    pty: Box<dyn pty::PtyHandler + Send>,
    io: io::IoPipeline,
    renderer: renderer::SurfaceRenderer,
    config: config::TerminalConfig,
    health: Arc<Mutex<TerminalHealth>>,
    clipboard: clipboard::ClipboardBridge,
}

impl TerminalInstance {
    pub fn spawn(shell: Option<&str>, config: config::TerminalConfig) -> Result<Self, TerminalError> {
        let shell_path = shell
            .map(|s| s.to_string())
            .or_else(|| std::env::var("SHELL").ok())
            .unwrap_or_else(|| {
                if cfg!(windows) { "pwsh.exe".into() } else { "/bin/bash".into() }
            });

        let pty: Box<dyn pty::PtyHandler + Send> = {
            #[cfg(unix)]
            { Box::new(pty::unix::UnixPty::open(&shell_path)?) }
            #[cfg(windows)]
            { Box::new(pty::windows::WindowsPty::open(&shell_path)?) }
        };

        let io = io::IoPipeline::new(pty.fd_read(), pty.fd_write())?;
        let renderer = renderer::SurfaceRenderer::new(&config)?;
        let health = Arc::new(Mutex::new(TerminalHealth::new()));
        let clipboard = clipboard::ClipboardBridge::new();

        Ok(Self { pty, io, renderer, config, health, clipboard })
    }

    pub fn io(&self) -> &io::IoPipeline {
        &self.io
    }

    pub fn renderer(&self) -> &renderer::SurfaceRenderer {
        &self.renderer
    }

    pub fn health(&self) -> Arc<Mutex<TerminalHealth>> {
        self.health.clone()
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), TerminalError> {
        resize::handle_resize(self.pty.as_ref(), cols, rows)
    }

    pub fn clipboard(&self) -> &clipboard::ClipboardBridge {
        &self.clipboard
    }

    pub fn shutdown(self) -> Result<(), TerminalError> {
        self.io.shutdown()?;
        self.pty.shutdown()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("PTY spawn failed: {0}")]
    PtySpawn(String),
    #[error("I/O pipeline error: {0}")]
    IoPipeline(String),
    #[error("Renderer error: {0}")]
    Renderer(String),
    #[error("Unsupported platform")]
    UnsupportedPlatform,
    #[error("Configuration error: {0}")]
    Config(String),
    #[error("Resize failed: {0}")]
    Resize(String),
}

#[cfg(target_os = "macos")]
pub mod platform {
    pub type SurfaceHandle = core_foundation::base::CFTypeRef;
    pub type SharedMemory = crate::renderer::texture_bridge::IOSurfaceBridge;
}

#[cfg(target_os = "linux")]
pub mod platform {
    pub type SurfaceHandle = std::os::raw::c_ulong;
    pub type SharedMemory = crate::renderer::texture_bridge::DmaBufBridge;
}

#[cfg(target_os = "windows")]
pub mod platform {
    pub type SurfaceHandle = isize;
    pub type SharedMemory = crate::renderer::texture_bridge::SharedHandleBridge;
}
