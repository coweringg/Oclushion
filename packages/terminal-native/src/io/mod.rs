pub mod read_thread;
pub mod render_thread;
pub mod write_thread;

use crate::TerminalError;
use std::os::raw::c_int;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

pub struct IoPipeline {
    read_handle: Option<std::thread::JoinHandle<()>>,
    write_handle: Option<std::thread::JoinHandle<()>>,
    render_handle: Option<std::thread::JoinHandle<()>>,
    write_tx: mpsc::Sender<Vec<u8>>,
    shutdown_flag: Arc<AtomicBool>,
}

impl IoPipeline {
    pub fn new(read_fd: c_int, write_fd: c_int) -> Result<Self, TerminalError> {
        let shutdown_flag = Arc::new(AtomicBool::new(false));
        let (write_tx, write_rx) = mpsc::channel::<Vec<u8>>();

        let rd_flag = shutdown_flag.clone();
        let read_handle = std::thread::Builder::new()
            .name("pty-read".into())
            .spawn(move || read_thread::read_loop(read_fd, rd_flag))
            .map_err(|e| TerminalError::IoPipeline(format!("spawn read thread: {}", e)))?;

        let wt_flag = shutdown_flag.clone();
        let write_handle = std::thread::Builder::new()
            .name("pty-write".into())
            .spawn(move || write_thread::write_loop(write_fd, write_rx, wt_flag))
            .map_err(|e| TerminalError::IoPipeline(format!("spawn write thread: {}", e)))?;

        let rnd_flag = shutdown_flag.clone();
        let render_handle = std::thread::Builder::new()
            .name("pty-render".into())
            .spawn(move || render_thread::render_loop(rnd_flag))
            .map_err(|e| TerminalError::IoPipeline(format!("spawn render thread: {}", e)))?;

        Ok(Self {
            read_handle: Some(read_handle),
            write_handle: Some(write_handle),
            render_handle: Some(render_handle),
            write_tx,
            shutdown_flag,
        })
    }

    pub fn write(&self, data: Vec<u8>) -> Result<(), TerminalError> {
        self.write_tx
            .send(data)
            .map_err(|e| TerminalError::IoPipeline(format!("write channel: {}", e)))
    }

    pub fn shutdown(&self) -> Result<(), TerminalError> {
        self.shutdown_flag.store(true, Ordering::SeqCst);
        Ok(())
    }
}
