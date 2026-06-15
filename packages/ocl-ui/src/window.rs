use crate::engine::Engine;
use crate::render::pipeline::RenderPipeline;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::Arc;
use std::time::Instant;

pub struct UiApp {
    engine: Rc<RefCell<Engine>>,
    renderer: Option<Rc<RefCell<RenderPipeline>>>,
    window: Option<Arc<winit::window::Window>>,
    last_frame: Instant,
}

impl UiApp {
    pub fn new() -> Self {
        Self {
            engine: Rc::new(RefCell::new(Engine::new())),
            renderer: None,
            window: None,
            last_frame: Instant::now(),
        }
    }
}

impl winit::application::ApplicationHandler for UiApp {
    fn resumed(&mut self, event_loop: &winit::event_loop::ActiveEventLoop) {
        let attributes = winit::window::Window::default_attributes()
            .with_title("Oclushion IDE")
            .with_inner_size(winit::dpi::LogicalSize::new(1280.0, 800.0));
        if let Ok(window) = event_loop.create_window(attributes) {
            let window = Arc::new(window);
            let size = window.inner_size();
            self.engine.borrow_mut().set_viewport(size.width, size.height);

            let instance = wgpu::Instance::default();
            let surface = instance.create_surface(window.clone()).unwrap();
            let adapter = pollster::block_on(instance.request_adapter(
                &wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::HighPerformance,
                    compatible_surface: Some(&surface),
                    force_fallback_adapter: false,
                },
            )).unwrap();
            let (device, queue) = pollster::block_on(adapter.request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("oclushion-gpu"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::Performance,
                    experimental_features: wgpu::ExperimentalFeatures::default(),
                    trace: wgpu::Trace::default(),
                },
            )).unwrap();
            let caps = surface.get_capabilities(&adapter);
            let format = caps.formats.iter().find(|f| f.is_srgb()).copied()
                .unwrap_or(wgpu::TextureFormat::Bgra8UnormSrgb);
            let config = wgpu::SurfaceConfiguration {
                usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                format,
                width: size.width.max(1),
                height: size.height.max(1),
                present_mode: wgpu::PresentMode::Fifo,
                desired_maximum_frame_latency: 2,
                alpha_mode: wgpu::CompositeAlphaMode::Auto,
                view_formats: vec![],
            };
            surface.configure(&device, &config);
            let rp = RenderPipeline::new(surface, device, queue, config);
            self.renderer = Some(Rc::new(RefCell::new(rp)));
            self.window = Some(window);
        }
    }

    fn window_event(
        &mut self,
        _event_loop: &winit::event_loop::ActiveEventLoop,
        _window_id: winit::window::WindowId,
        event: winit::event::WindowEvent,
    ) {
        match &event {
            winit::event::WindowEvent::CloseRequested => std::process::exit(0),
            winit::event::WindowEvent::Resized(size) => {
                if let Some(r) = &self.renderer {
                    r.borrow_mut().resize(*size);
                }
                self.engine.borrow_mut().set_viewport(size.width, size.height);
            }
            winit::event::WindowEvent::RedrawRequested => {
                let now = Instant::now();
                let dt = now.duration_since(self.last_frame).as_secs_f64();
                self.last_frame = now;
                self.engine.borrow_mut().animate(dt);
                if let Some(r) = &self.renderer {
                    let _ = r.borrow().render(&self.engine.borrow());
                }
            }
            _ => {}
        }
        self.engine.borrow_mut().handle_event(&event);
    }

    fn about_to_wait(&mut self, _event_loop: &winit::event_loop::ActiveEventLoop) {
        self.engine.borrow_mut().update();
        if let Some(w) = &self.window {
            w.request_redraw();
        }
    }
}

pub fn run_app() {
    tracing_subscriber::fmt::init();
    let event_loop = winit::event_loop::EventLoop::new().expect("EventLoop");
    let mut app = UiApp::new();
    let _ = event_loop.run_app(&mut app);
}
