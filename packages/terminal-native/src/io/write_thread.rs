use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::Arc;

pub fn write_loop(fd: c_int, rx: Receiver<Vec<u8>>, shutdown: Arc<AtomicBool>) {
    loop {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }
        let data = match rx.recv() {
            Ok(d) => d,
            Err(_) => break,
        };
        let mut written = 0;
        while written < data.len() {
            let n = unsafe {
                libc::write(
                    fd,
                    data[written..].as_ptr() as *const libc::c_void,
                    (data.len() - written).try_into().unwrap(),
                )
            };
            if n <= 0 {
                let err = std::io::Error::last_os_error();
                if err.kind() == std::io::ErrorKind::Interrupted {
                    continue;
                }
                log::error!("[pty-write] write error: {}", err);
                return;
            }
            written += n as usize;
        }
        log::trace!("[pty-write] wrote {} bytes to PTY", data.len());
    }
    log::info!("[pty-write] thread exiting");
}
