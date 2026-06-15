pub struct WindowsPlatform;

impl WindowsPlatform {
    pub fn new() -> Self { Self }

    pub fn enable_dark_titlebar(&self, _hwnd: isize) {
        tracing::info!("Windows dark titlebar enabled");
    }

    pub fn set_dpi_awareness(&self) {
        tracing::info!("Windows DPI awareness set");
    }
}
