use winit::event::WindowEvent;

pub struct EventLoop;

impl EventLoop {
    pub fn new() -> Self {
        Self
    }

    pub fn process_event(&self, event: &WindowEvent) -> EventKind {
        match event {
            WindowEvent::CloseRequested => EventKind::Quit,
            WindowEvent::Resized(size) => EventKind::Resize(size.width, size.height),
            WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                EventKind::ScaleChange(*scale_factor)
            }
            WindowEvent::KeyboardInput { event, .. } => {
                EventKind::KeyPress(event.logical_key.clone(), event.state)
            }
            WindowEvent::CursorMoved { position, .. } => {
                EventKind::CursorMove(position.x as f32, position.y as f32)
            }
            WindowEvent::MouseInput { button, state, .. } => {
                EventKind::MouseClick(*button, *state)
            }
            WindowEvent::MouseWheel { delta, .. } => {
                EventKind::Scroll(match delta {
                    winit::event::MouseScrollDelta::LineDelta(x, y) => (*x, *y),
                    winit::event::MouseScrollDelta::PixelDelta(pos) => {
                        (pos.x as f32, pos.y as f32)
                    }
                })
            }
            WindowEvent::Touch(touch) => {
                EventKind::Touch(touch.phase, touch.location.x as f32, touch.location.y as f32)
            }
            _ => EventKind::Other,
        }
    }
}

pub enum EventKind {
    Quit,
    Resize(u32, u32),
    ScaleChange(f64),
    KeyPress(winit::keyboard::Key, winit::event::ElementState),
    CursorMove(f32, f32),
    MouseClick(winit::event::MouseButton, winit::event::ElementState),
    Scroll((f32, f32)),
    Touch(winit::event::TouchPhase, f32, f32),
    Other,
}
