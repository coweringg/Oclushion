use crate::{SandboxError, SandboxErrorKind};
use std::time::Instant;

pub struct TimeGuard {
    fuel_amount: u64,
}

impl TimeGuard {
    pub fn new(fuel_amount: u64) -> Self {
        TimeGuard { fuel_amount }
    }

    pub fn set_fuel(&mut self, amount: u64) {
        self.fuel_amount = amount;
    }

    pub fn get_fuel_amount(&self) -> u64 {
        self.fuel_amount
    }

    pub fn check_timeout(&self, start: Instant, timeout_ms: u64) -> crate::Result<()> {
        let elapsed = start.elapsed().as_millis() as u64;
        if elapsed > timeout_ms {
            return Err(SandboxError {
                kind: SandboxErrorKind::Timeout,
                message: format!(
                    "execution timed out after {} ms (limit: {} ms)",
                    elapsed, timeout_ms
                ),
                backtrace: None,
            });
        }
        Ok(())
    }
}

impl Default for TimeGuard {
    fn default() -> Self {
        TimeGuard::new(10_000_000)
    }
}
