pub struct ClipboardBridge;

impl ClipboardBridge {
    pub fn new() -> Self {
        Self
    }

    pub fn copy(&self, _text: &str) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            let mut child = Command::new("pbcopy").stdin(std::process::Stdio::piped()).spawn()
                .map_err(|e| format!("pbcopy spawn: {}", e))?;
            if let Some(mut stdin) = child.stdin.take() {
                use std::io::Write;
                stdin.write_all(text.as_bytes()).map_err(|e| format!("pbcopy write: {}", e))?;
            }
            child.wait().map_err(|e| format!("pbcopy wait: {}", e))?;
            return Ok(());
        }
        #[cfg(target_os = "linux")]
        {
            use std::process::Command;
            if Command::new("xclip").arg("-selection").arg("clipboard").spawn().is_ok() {
                return Ok(());
            }
        }
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            if Command::new("clip").spawn().is_ok() {
                return Ok(());
            }
        }
        Err("No clipboard tool available on this platform".into())
    }

    pub fn paste() -> Result<String, String> {
        #[cfg(target_os = "macos")]
        {
            let output = std::process::Command::new("pbpaste").output()
                .map_err(|e| format!("pbpaste: {}", e))?;
            return String::from_utf8(output.stdout).map_err(|e| e.to_string());
        }
        #[cfg(target_os = "linux")]
        {
            let output = std::process::Command::new("xclip").arg("-selection").arg("clipboard").arg("-o").output()
                .map_err(|e| format!("xclip: {}", e))?;
            return String::from_utf8(output.stdout).map_err(|e| e.to_string());
        }
        Err("No clipboard tool available on this platform".into())
    }
}
