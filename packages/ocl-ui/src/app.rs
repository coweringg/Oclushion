use crate::engine::Engine;
use std::cell::RefCell;
use std::rc::Rc;

pub struct App {
    pub engine: Rc<RefCell<Engine>>,
}

impl App {
    pub fn new() -> Self {
        Self { engine: Rc::new(RefCell::new(Engine::new())) }
    }

    pub fn run(self) {
        crate::window::run_app()
    }
}
