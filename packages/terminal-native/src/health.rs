use std::time::Instant;

pub struct TerminalHealth {
    started_at: Instant,
    frames_rendered: u64,
    bytes_written: u64,
    bytes_read: u64,
    errors: Vec<String>,
    last_report: Instant,
}

impl TerminalHealth {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            started_at: now,
            frames_rendered: 0,
            bytes_written: 0,
            bytes_read: 0,
            errors: Vec::with_capacity(16),
            last_report: now,
        }
    }

    pub fn record_frame(&mut self) {
        self.frames_rendered += 1;
    }

    pub fn record_write(&mut self, n: u64) {
        self.bytes_written += n;
    }

    pub fn record_read(&mut self, n: u64) {
        self.bytes_read += n;
    }

    pub fn record_error(&mut self, err: String) {
        if self.errors.len() < 100 {
            self.errors.push(err);
        }
    }

    pub fn uptime_secs(&self) -> f64 {
        self.started_at.elapsed().as_secs_f64()
    }

    pub fn fps(&self) -> f64 {
        let secs = self.uptime_secs();
        if secs > 0.0 { self.frames_rendered as f64 / secs } else { 0.0 }
    }

    pub fn throughput_written(&self) -> f64 {
        let secs = self.uptime_secs();
        if secs > 0.0 { self.bytes_written as f64 / secs } else { 0.0 }
    }

    pub fn throughput_read(&self) -> f64 {
        let secs = self.uptime_secs();
        if secs > 0.0 { self.bytes_read as f64 / secs } else { 0.0 }
    }

    pub fn report(&mut self) -> HealthReport {
        let now = Instant::now();
        let elapsed = (now - self.last_report).as_secs_f64();
        let report = HealthReport {
            uptime_secs: self.uptime_secs(),
            fps: self.fps(),
            throughput_written: self.throughput_written(),
            throughput_read: self.throughput_read(),
            total_frames: self.frames_rendered,
            total_bytes_written: self.bytes_written,
            total_bytes_read: self.bytes_read,
            error_count: self.errors.len() as u64,
            recent_fps: if elapsed > 0.0 { (self.frames_rendered - (self.frames_rendered.saturating_sub((elapsed * 120.0) as u64))) as f64 / elapsed } else { 0.0 },
        };
        self.last_report = now;
        report
    }
}

pub struct HealthReport {
    pub uptime_secs: f64,
    pub fps: f64,
    pub throughput_written: f64,
    pub throughput_read: f64,
    pub total_frames: u64,
    pub total_bytes_written: u64,
    pub total_bytes_read: u64,
    pub error_count: u64,
    pub recent_fps: f64,
}
