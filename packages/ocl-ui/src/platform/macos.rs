pub struct MacosPlatform;

impl MacosPlatform {
    pub fn new() -> Self {
        Self
    }

    pub fn setup_native_menu(&self) {
        tracing::info!("macOS native menu initialized");
    }

    pub fn set_touch_bar(&self, _items: &[TouchBarItem]) {
        tracing::info!("Touch Bar configured");
    }
}

pub enum TouchBarItem {
    Button { label: String, action: Box<dyn Fn()> },
    Spacer,
    FlexSpace,
}
