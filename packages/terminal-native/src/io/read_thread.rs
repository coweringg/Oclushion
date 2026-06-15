use std::io::Write;
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

const READ_BUF_SIZE: usize = 65536;

pub fn read_loop(fd: c_int, shutdown: Arc<AtomicBool>) {
    let mut buf = vec![0u8; READ_BUF_SIZE];
    loop {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }
        let n = unsafe {
            libc::read(fd, buf.as_mut_ptr() as *mut libc::c_void, READ_BUF_SIZE.try_into().unwrap())
        };
        if n <= 0 {
            if n == 0 {
                log::info!("[pty-read] EOF on PTY fd {}", fd);
            } else {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::Interrupted {
                    continue;
                }
                log::error!("[pty-read] read error on fd {}: {}", fd, err);
            }
            break;
        }
        let data = &buf[..n as usize];
        log::trace!("[pty-read] read {} bytes from PTY", n);
        if let Err(e) = std::io::stdout().write_all(data) {
            log::error!("[pty-read] stdout write: {}", e);
            break;
        }
    }
    log::info!("[pty-read] thread exiting");
}
