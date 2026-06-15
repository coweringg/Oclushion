pub mod spring;
pub mod tween;
pub mod timeline;

use std::time::Duration;

pub struct AnimationEngine {
    springs: Vec<SpringAnimation>,
    tweens: Vec<TweenAnimation>,
}

struct SpringAnimation {
    value: f64,
    velocity: f64,
    target: f64,
    stiffness: f64,
    damping: f64,
    done: bool,
}

impl SpringAnimation {
    fn new(from: f64, to: f64) -> Self {
        Self {
            value: from,
            velocity: 0.0,
            target: to,
            stiffness: 300.0,
            damping: 25.0,
            done: false,
        }
    }

    fn update(&mut self, dt: f64) {
        if self.done { return; }
        let spring_force = -self.stiffness * (self.value - self.target);
        let damping_force = -self.damping * self.velocity;
        let acceleration = spring_force + damping_force;
        self.velocity += acceleration * dt;
        self.value += self.velocity * dt;
        if (self.value - self.target).abs() < 0.001 && self.velocity.abs() < 0.001 {
            self.value = self.target;
            self.done = true;
        }
    }
}

struct TweenAnimation {
    from: f64,
    to: f64,
    duration: f64,
    elapsed: f64,
    easing: fn(f64) -> f64,
    done: bool,
}

impl TweenAnimation {
    fn update(&mut self, dt: f64) -> f64 {
        if self.done { return self.to; }
        self.elapsed += dt;
        let t = (self.elapsed / self.duration).clamp(0.0, 1.0);
        if t >= 1.0 { self.done = true; return self.to; }
        self.from + (self.to - self.from) * (self.easing)(t)
    }
}

impl AnimationEngine {
    pub fn new() -> Self {
        Self { springs: vec![], tweens: vec![] }
    }

    pub fn update(&mut self, dt: Duration) -> bool {
        let dt = dt.as_secs_f64();
        if dt <= 0.0 || dt > 0.1 { return false; }
        let mut any_active = false;
        for spring in &mut self.springs {
            spring.update(dt);
            if !spring.done { any_active = true; }
        }
        self.springs.retain(|s| !s.done);
        for tween in &mut self.tweens {
            tween.update(dt);
            if !tween.done { any_active = true; }
        }
        self.tweens.retain(|t| !t.done);
        any_active
    }

    pub fn spring(&mut self, from: f64, to: f64) -> f64 {
        self.springs.push(SpringAnimation::new(from, to));
        from
    }

    pub fn tween(&mut self, from: f64, to: f64, duration: f64, easing: fn(f64) -> f64) -> f64 {
        self.tweens.push(TweenAnimation {
            from, to, duration, elapsed: 0.0, easing, done: false,
        });
        from
    }

    pub fn is_empty(&self) -> bool {
        self.springs.is_empty() && self.tweens.is_empty()
    }
}

pub fn ease_in_out_cubic(t: f64) -> f64 {
    if t < 0.5 { 4.0 * t * t * t } else { 1.0 - (-2.0 * t + 2.0).powi(3) / 2.0 }
}

pub fn ease_out_quint(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(5)
}
