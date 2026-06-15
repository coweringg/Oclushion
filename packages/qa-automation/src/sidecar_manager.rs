use crate::{IpcMessage, IpcResponse, QaError, QaResult, SidecarStatus};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

pub struct SidecarManager {
    sidecar_path: PathBuf,
    data_dir: PathBuf,
    process: Mutex<Option<Child>>,
    stdin_writer: Mutex<Option<ChildStdin>>,
    is_running: AtomicBool,
    started_at: Mutex<Option<Instant>>,
    active_tests: Mutex<u32>,
    browser_ready: AtomicBool,
}

impl SidecarManager {
    pub fn new(sidecar_path: PathBuf, data_dir: PathBuf) -> Self {
        Self {
            sidecar_path,
            data_dir,
            process: Mutex::new(None),
            stdin_writer: Mutex::new(None),
            is_running: AtomicBool::new(false),
            started_at: Mutex::new(None),
            active_tests: Mutex::new(0),
            browser_ready: AtomicBool::new(false),
        }
    }

    pub fn start(&self) -> QaResult<()> {
        let browser_path = SidecarManager::browser_path();
        std::fs::create_dir_all(&browser_path)?;
        std::fs::create_dir_all(&self.data_dir)?;

        let mut child = Command::new("node")
            .arg(&self.sidecar_path)
            .env("OCLUSHOIN_BROWSER_DIR", browser_path.to_str().unwrap_or(""))
            .env("OCLUSHOIN_QA_DIR", self.data_dir.to_str().unwrap_or(""))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| QaError::SidecarCrashed(format!("Failed to spawn sidecar: {e}")))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| QaError::SidecarCrashed("No stdout on sidecar process".into()))?;

        let stdin_writer = child
            .stdin
            .take()
            .ok_or_else(|| QaError::SidecarCrashed("No stdin on sidecar process".into()))?;

        let reader = BufReader::new(stdout);
        let mut ready_line = String::new();

        let deadline = Instant::now() + Duration::from_secs(10);
        let mut found_ready = false;

        let mut lines = reader.lines();
        while Instant::now() < deadline {
            match lines.next() {
                Some(Ok(line)) => {
                    if line.trim() == "READY" {
                        found_ready = true;
                        break;
                    }
                    ready_line = line;
                }
                Some(Err(e)) => {
                    return Err(QaError::SidecarCrashed(format!(
                        "Error reading sidecar stdout: {e}"
                    )));
                }
                None => {
                    return Err(QaError::SidecarCrashed(
                        "Sidecar process exited before READY".into(),
                    ));
                }
            }
        }

        if !found_ready {
            let _ = child.kill();
            return Err(QaError::SidecarCrashed(format!(
                "Sidecar did not signal READY within 10s. Last output: {ready_line}"
            )));
        }

        *self.process.lock().unwrap() = Some(child);
        *self.stdin_writer.lock().unwrap() = Some(stdin_writer);
        *self.started_at.lock().unwrap() = Some(Instant::now());
        self.is_running.store(true, Ordering::SeqCst);
        self.browser_ready.store(true, Ordering::SeqCst);

        Ok(())
    }

    pub fn stop(&self) -> QaResult<()> {
        self.is_running.store(false, Ordering::SeqCst);

        if let Some(mut child) = self.process.lock().unwrap().take() {
            #[cfg(unix)]
            {
                let _ = Command::new("kill")
                    .arg("-TERM")
                    .arg(child.id().to_string())
                    .spawn();
            }

            #[cfg(not(unix))]
            {
                let _ = child.kill();
            }

            let deadline = Instant::now() + Duration::from_secs(3);
            while Instant::now() < deadline {
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                    Err(_) => break,
                }
            }

            let _ = child.kill();
            let _ = child.wait();
        }

        *self.stdin_writer.lock().unwrap() = None;
        *self.started_at.lock().unwrap() = None;

        Ok(())
    }

    pub fn restart(&self) -> QaResult<()> {
        self.stop()?;
        std::thread::sleep(Duration::from_millis(300));
        self.start()?;
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn is_healthy(&self) -> bool {
        if !self.is_running() {
            return false;
        }

        let msg = IpcMessage {
            id: Uuid::new_v4(),
            method: "ping".into(),
            params: serde_json::json!({}),
        };

        match self.send_message(msg) {
            Ok(resp) => resp.error.is_none(),
            Err(_) => false,
        }
    }

    pub fn get_status(&self) -> SidecarStatus {
        let pid = self.pid().unwrap_or(0);
        let uptime = self
            .started_at
            .lock()
            .unwrap()
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);
        let active = *self.active_tests.lock().unwrap();

        SidecarStatus {
            pid,
            uptime_secs: uptime,
            is_healthy: self.is_healthy(),
            active_tests: active,
            browser_ready: self.browser_ready.load(Ordering::SeqCst),
        }
    }

    pub fn pid(&self) -> Option<u32> {
        self.process
            .lock()
            .unwrap()
            .as_ref()
            .map(|c| c.id())
    }

    pub fn send_message(&self, msg: IpcMessage) -> QaResult<IpcResponse> {
        let json = serde_json::to_string(&msg)?;

        {
            let mut writer = self.stdin_writer.lock().unwrap();
            let writer = writer
                .as_mut()
                .ok_or_else(|| QaError::IpcError("Sidecar not started".into()))?;
            writeln!(writer, "{json}").map_err(|e| QaError::IpcError(e.to_string()))?;
            writer
                .flush()
                .map_err(|e| QaError::IpcError(e.to_string()))?;
        }

        let mut response_line = String::new();
        {
            let mut guard = self.process.lock().unwrap();
            let child = guard
                .as_mut()
                .ok_or_else(|| QaError::IpcError("Sidecar not started".into()))?;

            let stdout = child
                .stdout
                .as_mut()
                .ok_or_else(|| QaError::IpcError("No stdout".into()))?;

            let mut reader = BufReader::new(stdout);

            let deadline = Instant::now() + Duration::from_secs(30);
            while Instant::now() < deadline {
                response_line.clear();
                if reader.read_line(&mut response_line)? == 0 {
                    return Err(QaError::IpcError("Sidecar closed stdout".into()));
                }
                let trimmed = response_line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let resp: IpcResponse = serde_json::from_str(trimmed)?;
                if resp.id == msg.id {
                    return Ok(resp);
                }
            }

            Err(QaError::Timeout)
        }
    }

    pub fn browser_path() -> PathBuf {
        let home = dirs_next().unwrap_or_else(|| PathBuf::from("."));
        home.join(".oclushion").join("browser")
    }

    #[allow(dead_code)]
    fn data_dir_path(&self) -> PathBuf {
        self.data_dir.clone()
    }
}

fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var("HOMEDRIVE")
                    .ok()
                    .zip(std::env::var("HOMEPATH").ok())
                    .map(|(d, p)| PathBuf::from(format!("{d}{p}")))
            })
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}
