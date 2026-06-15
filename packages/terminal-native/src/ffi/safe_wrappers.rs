use super::bindings;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr::NonNull;

pub struct GhosttyConfig {
    inner: NonNull<bindings::ghostty_config_s>,
}

impl GhosttyConfig {
    pub fn new() -> Result<Self, String> {
        let ptr = unsafe { bindings::ghostty_config_new() };
        NonNull::new(ptr)
            .map(|inner| Self { inner })
            .ok_or_else(|| "ghostty_config_new returned null".to_string())
    }

    pub fn set(&self, key: &str, value: &str) -> Result<(), String> {
        let c_key = CString::new(key).map_err(|e| e.to_string())?;
        let c_val = CString::new(value).map_err(|e| e.to_string())?;
        let ret = unsafe { bindings::ghostty_config_set(self.inner.as_ptr(), c_key.as_ptr(), c_val.as_ptr()) };
        if ret != 0 {
            return Err(format!("ghostty_config_set returned {}", ret));
        }
        Ok(())
    }

    pub fn as_ptr(&self) -> *mut bindings::ghostty_config_s {
        self.inner.as_ptr()
    }
}

impl Drop for GhosttyConfig {
    fn drop(&mut self) {
        unsafe { bindings::ghostty_config_free(self.inner.as_ptr()) };
    }
}

pub struct GhosttyTerminal {
    inner: NonNull<bindings::ghostty_terminal_s>,
}

impl GhosttyTerminal {
    pub fn new(config: &GhosttyConfig) -> Result<Self, String> {
        let ptr = unsafe { bindings::ghostty_terminal_new(config.as_ptr()) };
        NonNull::new(ptr)
            .map(|inner| Self { inner })
            .ok_or_else(|| "ghostty_terminal_new returned null".to_string())
    }

    pub fn inject(&self, data: &[u8]) -> Result<usize, String> {
        let ret = unsafe {
            bindings::ghostty_terminal_inject(
                self.inner.as_ptr(),
                data.as_ptr() as *const c_char,
                data.len(),
            )
        };
        if ret < 0 {
            return Err(format!("ghostty_terminal_inject returned {}", ret));
        }
        Ok(ret as usize)
    }

    pub fn read_output(&self, buf: &mut [u8]) -> Result<usize, String> {
        let ret = unsafe {
            bindings::ghostty_terminal_read(
                self.inner.as_ptr(),
                buf.as_mut_ptr() as *mut c_char,
                buf.len(),
            )
        };
        if ret < 0 {
            return Err(format!("ghostty_terminal_read returned {}", ret));
        }
        Ok(ret as usize)
    }

    pub fn resize(&self, cols: u16, rows: u16) {
        unsafe { bindings::ghostty_terminal_resize(self.inner.as_ptr(), cols as u32, rows as u32) };
    }

    pub fn render_frame(&self, surface_id: u64) -> Result<(), String> {
        let ret = unsafe { bindings::ghostty_terminal_render(self.inner.as_ptr(), surface_id) };
        if ret != 0 {
            return Err(format!("ghostty_terminal_render returned {}", ret));
        }
        Ok(())
    }

    pub fn as_ptr(&self) -> *mut bindings::ghostty_terminal_s {
        self.inner.as_ptr()
    }
}

impl Drop for GhosttyTerminal {
    fn drop(&mut self) {
        unsafe { bindings::ghostty_terminal_free(self.inner.as_ptr()) };
    }
}

pub struct GhosttySurface {
    inner: NonNull<bindings::ghostty_surface_s>,
}

impl GhosttySurface {
    pub fn new(term: &GhosttyTerminal, width: u32, height: u32, scale: f64) -> Result<Self, String> {
        let ptr = unsafe { bindings::ghostty_surface_new(term.as_ptr(), width, height, scale) };
        NonNull::new(ptr)
            .map(|inner| Self { inner })
            .ok_or_else(|| "ghostty_surface_new returned null".to_string())
    }

    pub fn id(&self) -> u64 {
        unsafe { bindings::ghostty_surface_id(self.inner.as_ptr()) }
    }

    pub fn as_ptr(&self) -> *mut bindings::ghostty_surface_s {
        self.inner.as_ptr()
    }
}

impl Drop for GhosttySurface {
    fn drop(&mut self) {
        unsafe { bindings::ghostty_surface_free(self.inner.as_ptr()) };
    }
}

pub fn ghostty_version() -> String {
    unsafe {
        let ptr = bindings::ghostty_version();
        if ptr.is_null() {
            return "unknown".to_string();
        }
        CStr::from_ptr(ptr).to_string_lossy().into_owned()
    }
}
