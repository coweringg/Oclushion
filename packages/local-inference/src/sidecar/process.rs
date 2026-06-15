use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use crate::SidecarError;

pub struct SidecarProcess {
    binary_path: PathBuf,
    model_path: PathBuf,
    process: Mutex<Option<Child>>,
    port: u16,
}

impl SidecarProcess {
    pub fn new(binary_path: PathBuf, model_path: PathBuf) -> Self {
        Self {
            binary_path,
            model_path,
            process: Mutex::new(None),
            port: 8080,
        }
    }

    pub fn spawn(&self) -> Result<(), SidecarError> {
        let mut proc_lock = self.process.lock().map_err(|e| SidecarError::SpawnFailed(e.to_string()))?;

        if proc_lock.is_some() {
            return Err(SidecarError::SpawnFailed("Process already running".into()));
        }

        let child = Command::new(&self.binary_path)
            .arg("-m")
            .arg(&self.model_path)
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(self.port.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| SidecarError::SpawnFailed(format!("Failed to start llama.cpp: {}", e)))?;

        *proc_lock = Some(child);
        Ok(())
    }

    pub fn kill(&self) -> Result<(), SidecarError> {
        let mut proc_lock = self.process.lock().map_err(|e| SidecarError::KillFailed(e.to_string()))?;

        match proc_lock.take() {
            Some(mut child) => {
                child.kill().map_err(|e| SidecarError::KillFailed(format!("Failed to kill process: {}", e)))?;
                child.wait().ok();
                Ok(())
            }
            None => Err(SidecarError::NotRunning),
        }
    }

    pub fn restart(&self) -> Result<(), SidecarError> {
        self.kill()?;
        self.spawn()
    }

    pub fn is_running(&self) -> bool {
        let mut lock = match self.process.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        match lock.as_mut() {
            Some(child) => child.try_wait().ok().flatten().is_none(),
            None => false,
        }
    }

    pub fn pid(&self) -> Option<u32> {
        let lock = match self.process.lock() {
            Ok(guard) => guard,
            Err(_) => return None,
        };
        lock.as_ref().map(|child| child.id())
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}
