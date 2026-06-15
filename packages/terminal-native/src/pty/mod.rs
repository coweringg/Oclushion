#[cfg(unix)]
pub mod unix;
#[cfg(windows)]
pub mod windows;

use std::os::raw::c_int;

pub trait PtyHandler {
    fn fd_read(&self) -> c_int;
    fn fd_write(&self) -> c_int;
    fn resize(&self, cols: u16, rows: u16) -> Result<(), String>;
    fn shutdown(self: Box<Self>) -> Result<(), super::TerminalError>;
    fn shell_pid(&self) -> u32;
}
