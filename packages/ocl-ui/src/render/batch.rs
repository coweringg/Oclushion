use crate::render::pipeline::RenderPipeline;
use bytemuck::{Pod, Zeroable};
use wgpu::Buffer;

#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct Vertex {
    pub position: [f32; 2],
    pub color: [f32; 4],
}

pub struct BatchRenderer {
    vertex_buffer: Option<Buffer>,
    index_buffer: Option<Buffer>,
    vertices: Vec<Vertex>,
    indices: Vec<u16>,
    max_quads: usize,
}

impl BatchRenderer {
    pub fn new(pipeline: &RenderPipeline, max_quads: usize) -> Self {
        let device = pipeline.device();
        let vertex_buffer = Some(device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("batch-vb"),
            size: (max_quads * 4 * std::mem::size_of::<Vertex>()) as u64,
            usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        }));
        let index_buffer = Some(device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("batch-ib"),
            size: (max_quads * 6 * std::mem::size_of::<u16>()) as u64,
            usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        }));
        Self {
            vertex_buffer,
            index_buffer,
            vertices: Vec::with_capacity(max_quads * 4),
            indices: Vec::with_capacity(max_quads * 6),
            max_quads,
        }
    }

    pub fn push_quad(&mut self, x: f32, y: f32, w: f32, h: f32, color: [f32; 4]) {
        let base = self.vertices.len() as u16;
        self.vertices.push(Vertex { position: [x, y], color });
        self.vertices.push(Vertex { position: [x + w, y], color });
        self.vertices.push(Vertex { position: [x + w, y + h], color });
        self.vertices.push(Vertex { position: [x, y + h], color });
        self.indices.extend_from_slice(&[
            base, base + 1, base + 2,
            base, base + 2, base + 3,
        ]);
    }

    pub fn flush(&mut self, queue: &wgpu::Queue) -> (Option<&Buffer>, usize, Option<&Buffer>) {
        if let Some(vb) = &self.vertex_buffer {
            queue.write_buffer(vb, 0, bytemuck::cast_slice(&self.vertices));
        }
        if let Some(ib) = &self.index_buffer {
            queue.write_buffer(ib, 0, bytemuck::cast_slice(&self.indices));
        }
        let count = self.indices.len();
        self.vertices.clear();
        self.indices.clear();
        (self.vertex_buffer.as_ref(), count, self.index_buffer.as_ref())
    }
}
