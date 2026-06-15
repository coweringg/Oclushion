pub struct ImeHandler;

impl ImeHandler {
    pub fn new() -> Self { Self }

    pub fn handle_input(&mut self, _text: &str) -> Option<String> {
        None
    }

    pub fn composition_started(&mut self) {}
    pub fn composition_ended(&mut self) {}
}
