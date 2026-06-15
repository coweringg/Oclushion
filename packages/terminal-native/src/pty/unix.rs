use super::PtyHandler;
use crate::TerminalError;
use libc::{self, c_int, pid_t, winsize};
use nix::errno::Errno;
use nix::pty::{forkpty, openpty, Winsize};
use nix::sys::signal::{kill, Signal};
use nix::sys::wait::waitpid;
use nix::unistd::{close, dup2, execvp, ForkResult};
use std::ffi::CString;
use std::os::unix::io::RawFd;

pub struct UnixPty {
    master_fd: RawFd,
    slave_fd: RawFd,
    child_pid: pid_t,
}

impl UnixPty {
    pub fn open(shell: &str) -> Result<Self, TerminalError> {
        let winsize = Winsize {
            ws_row: 24,
            ws_col: 80,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };

        let (master_fd, slave_fd) = openpty(&winsize).map_err(|e| {
            TerminalError::PtySpawn(format!("openpty failed: {}", e))
        })?;

        let shell_cstr = CString::new(shell).map_err(|_| {
            TerminalError::PtySpawn("null byte in shell path".into())
        })?;

        let child_pid = unsafe { libc::fork() };
        if child_pid == -1 {
            let _ = close(master_fd);
            let _ = close(slave_fd);
            return Err(TerminalError::PtySpawn("fork failed".into()));
        }

        if child_pid == 0 {
            let _ = close(master_fd);
            let _ = dup2(slave_fd, libc::STDIN_FILENO);
            let _ = dup2(slave_fd, libc::STDOUT_FILENO);
            let _ = dup2(slave_fd, libc::STDERR_FILENO);
            if slave_fd >= 3 {
                let _ = close(slave_fd);
            }
            let _ = libc::setsid();
            let args = [shell_cstr.as_ptr(), std::ptr::null()];
            let _ = execvp(&shell_cstr, args.as_ptr());
            std::process::exit(1);
        }

        let _ = close(slave_fd);

        Ok(Self { master_fd, slave_fd: -1, child_pid })
    }
}

impl PtyHandler for UnixPty {
    fn fd_read(&self) -> c_int {
        self.master_fd
    }

    fn fd_write(&self) -> c_int {
        self.master_fd
    }

    fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let ws = winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };
        let ret = unsafe {
            libc::ioctl(self.master_fd, libc::TIOCSWINSZ, &ws as *const winsize)
        };
        if ret != 0 {
            return Err(format!("ioctl TIOCSWINSZ failed: {}", Errno::last()));
        }
        unsafe { libc::kill(self.child_pid, libc::SIGWINCH) };
        Ok(())
    }

    fn shutdown(self: Box<Self>) -> Result<(), TerminalError> {
        let _ = kill(self.child_pid, Signal::SIGTERM);
        std::thread::sleep(std::time::Duration::from_millis(200));
        let _ = kill(self.child_pid, Signal::SIGKILL);
        let _ = close(self.master_fd);
        let _ = waitpid(self.child_pid, None);
        Ok(())
    }

    fn shell_pid(&self) -> u32 {
        self.child_pid as u32
    }
}
