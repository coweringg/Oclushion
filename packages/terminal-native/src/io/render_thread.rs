use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

const TARGET_FPS: u64 = 120;
const FRAME_DURATION_NS: u64 = 1_000_000_000 / TARGET_FPS;

pub fn render_loop(shutdown: Arc<AtomicBool>) {
    log::info!("[pty-render] render thread started at {} FPS target", TARGET_FPS);
    loop {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }
        let frame_start = std::time::Instant::now();
        render_frame();
        let elapsed = frame_start.elapsed().as_nanos() as u64;
        if elapsed < FRAME_DURATION_NS {
            std::thread::sleep(std::time::Duration::from_nanos(FRAME_DURATION_NS - elapsed));
        }
    }
    log::info!("[pty-render] thread exiting");
}

fn render_frame() {
    log::trace!("[pty-render] frame rendered at 120fps");
}
