use crate::engine::Engine;
use wgpu::CurrentSurfaceTexture;

pub struct RenderPipeline {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
}

impl RenderPipeline {
    pub fn new(surface: wgpu::Surface<'static>, device: wgpu::Device, queue: wgpu::Queue, config: wgpu::SurfaceConfiguration) -> Self {
        Self { surface, device, queue, config }
    }

    pub fn resize(&mut self, size: winit::dpi::PhysicalSize<u32>) {
        self.config.width = size.width.max(1);
        self.config.height = size.height.max(1);
        self.surface.configure(&self.device, &self.config);
    }

    pub fn render(&self, _engine: &Engine) -> Result<(), crate::UiError> {
        match self.surface.get_current_texture() {
            CurrentSurfaceTexture::Success(frame) | CurrentSurfaceTexture::Suboptimal(frame) => {
                let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());
                let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("main-encoder"),
                });
                {
                    let _pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                        label: Some("main-pass"),
                        color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                            view: &view,
                            resolve_target: None,
                            depth_slice: None,
                            ops: wgpu::Operations {
                                load: wgpu::LoadOp::Clear(wgpu::Color { r: 0.02, g: 0.02, b: 0.03, a: 1.0 }),
                                store: wgpu::StoreOp::Store,
                            },
                        })],
                        depth_stencil_attachment: None,
                        occlusion_query_set: None,
                        timestamp_writes: None,
                        multiview_mask: std::num::NonZero::new(0),
                    });
                }
                self.queue.submit(std::iter::once(encoder.finish()));
                frame.present();
                Ok(())
            }
            CurrentSurfaceTexture::Timeout => {
                std::thread::yield_now();
                Ok(())
            }
            CurrentSurfaceTexture::Occluded => Ok(()),
            CurrentSurfaceTexture::Outdated => {
                self.surface.configure(&self.device, &self.config);
                Ok(())
            }
            CurrentSurfaceTexture::Lost => {
                Err(crate::UiError::Render("Surface lost".into()))
            }
            CurrentSurfaceTexture::Validation => {
                Err(crate::UiError::Render("Surface validation error".into()))
            }
        }
    }

    pub fn device(&self) -> &wgpu::Device { &self.device }
    pub fn queue(&self) -> &wgpu::Queue { &self.queue }
    pub fn format(&self) -> wgpu::TextureFormat { self.config.format }
}
