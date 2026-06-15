use crate::engine::layout::Size;
use std::any::Any;
use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;

pub type SharedState = Rc<RefCell<dyn Any>>;

pub struct StateTree {
    root: StateNode,
    effects: VecDeque<Box<dyn FnOnce()>>,
    dirty: bool,
    viewport: Size,
    next_id: u64,
}

struct StateNode {
    id: u64,
    state: Option<SharedState>,
    children: Vec<StateNode>,
    dirty: bool,
}

impl StateTree {
    pub fn new() -> Self {
        Self {
            root: StateNode { id: 0, state: None, children: vec![], dirty: true },
            effects: VecDeque::new(),
            dirty: true,
            viewport: Size::new(1024.0, 768.0),
            next_id: 1,
        }
    }

    pub fn root_node(&self) -> &StateNode { &self.root }

    pub fn viewport_size(&self) -> Size { self.viewport }

    pub fn set_viewport(&mut self, width: u32, height: u32) {
        self.viewport = Size::new(width as f32, height as f32);
        self.dirty = true;
    }

    pub fn handle_event(&mut self, event: &winit::event::WindowEvent) {
        if let winit::event::WindowEvent::Resized(size) = event {
            self.set_viewport(size.width, size.height);
        }
    }

    pub fn process_effects(&mut self) {
        while let Some(effect) = self.effects.pop_front() {
            effect();
        }
    }

    pub fn is_dirty(&self) -> bool { self.dirty || self.root.dirty }

    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }
}

pub struct Signal<T: Clone + 'static> {
    value: Rc<RefCell<T>>,
    dirty: Rc<RefCell<bool>>,
}

impl<T: Clone + 'static> Signal<T> {
    pub fn new(value: T) -> Self {
        Self {
            value: Rc::new(RefCell::new(value)),
            dirty: Rc::new(RefCell::new(true)),
        }
    }

    pub fn get(&self) -> T {
        self.value.borrow().clone()
    }

    pub fn set(&self, new: T) {
        *self.value.borrow_mut() = new;
        *self.dirty.borrow_mut() = true;
    }

    pub fn is_dirty(&self) -> bool {
        *self.dirty.borrow()
    }

    pub fn mark_clean(&self) {
        *self.dirty.borrow_mut() = false;
    }
}

pub struct Effect {
    cleanup: Option<Box<dyn FnOnce()>>,
}

impl Effect {
    pub fn new(f: impl FnOnce() -> Option<Box<dyn FnOnce()>> + 'static) -> Self {
        let cleanup = f();
        Self { cleanup }
    }
}

impl Drop for Effect {
    fn drop(&mut self) {
        if let Some(cleanup) = self.cleanup.take() {
            cleanup();
        }
    }
}
