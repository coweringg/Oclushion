pub struct LinuxPlatform;

impl LinuxPlatform {
    pub fn new() -> Self { Self }

    pub fn detect_desktop_env(&self) -> &'static str {
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            "Wayland"
        } else if std::env::var("DISPLAY").is_ok() {
            "X11"
        } else {
            "Unknown"
        }
    }
}
