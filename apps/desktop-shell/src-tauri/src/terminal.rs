use serde::Serialize;
use std::{
  collections::HashMap,
  io::{BufReader, Read, Write},
  path::Path,
  process::{Child, ChildStdin, Command, Stdio},
  sync::{Arc, Mutex},
  thread,
};
use tauri::{AppHandle, Emitter, State};

const ALLOWED_AGENT_COMMANDS: &[&str] = &[
  "git", "node", "npm", "npx", "pnpm", "yarn", "bun",
  "cargo", "rustc", "rustup",
  "python", "python3", "pip", "pip3", "uv",
  "ls", "cat", "head", "tail", "grep", "find", "wc", "sort", "uniq", "diff",
  "echo", "pwd", "which", "whoami", "date",
  "mkdir", "cp", "mv", "touch",
  "tree", "du", "df",
];

const NETWORK_COMMANDS: &[&str] = &[
  "curl", "wget",
];

#[derive(Default)]
pub struct TerminalState {
  sessions: Mutex<HashMap<String, TerminalProcess>>,
}

struct TerminalProcess {
  owner: TerminalOwner,
  child: Option<Child>,
  stdin: Option<ChildStdin>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum TerminalOwner {
  User,
  Agent,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionPayload {
  session_id: String,
  pid: Option<u32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDataPayload {
  session_id: String,
  data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
  session_id: String,
  code: Option<i32>,
}

#[tauri::command]
pub fn terminal_spawn_user(
  app: AppHandle,
  state: State<'_, Arc<TerminalState>>,
  cwd: Option<String>,
) -> Result<TerminalSessionPayload, String> {
  let session_id = new_session_id("user");
  let mut command = default_shell_command();
  if let Some(path) = cwd {
    command.current_dir(path);
  }
  command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
  let mut child = command.spawn().map_err(|error| error.to_string())?;
  let pid = child.id();
  let stdin = child.stdin.take();
  attach_reader(&app, session_id.clone(), child.stdout.take());
  attach_reader(&app, session_id.clone(), child.stderr.take());
  state
    .sessions
    .lock()
    .map_err(|_| "terminal state lock poisoned".to_string())?
    .insert(
      session_id.clone(),
      TerminalProcess {
        owner: TerminalOwner::User,
        child: Some(child),
        stdin,
      },
    );
  attach_exit_watcher(&app, state.inner().clone(), session_id.clone());
  Ok(TerminalSessionPayload {
    session_id,
    pid: Some(pid),
  })
}

#[tauri::command]
pub fn terminal_spawn_agent(
  state: State<'_, Arc<TerminalState>>,
  cwd: Option<String>,
) -> Result<TerminalSessionPayload, String> {
  let session_id = new_session_id("agent");
  let _ = cwd;
  state
    .sessions
    .lock()
    .map_err(|_| "terminal state lock poisoned".to_string())?
    .insert(
      session_id.clone(),
      TerminalProcess {
        owner: TerminalOwner::Agent,
        child: None,
        stdin: None,
      },
    );
  Ok(TerminalSessionPayload {
    session_id,
    pid: None,
  })
}

#[tauri::command]
pub fn terminal_run_agent_command(
  app: AppHandle,
  state: State<'_, Arc<TerminalState>>,
  session_id: String,
  command: String,
  args: Vec<String>,
  cwd: Option<String>,
) -> Result<(), String> {
  {
    let sessions = state
      .sessions
      .lock()
      .map_err(|_| "terminal state lock poisoned".to_string())?;
    let session = sessions
      .get(&session_id)
      .ok_or_else(|| "agent terminal session not found".to_string())?;
    if session.owner != TerminalOwner::Agent {
      return Err("agent commands can only run inside the AI agent terminal".to_string());
    }
    if session.child.is_some() {
      return Err("agent terminal already has a running process".to_string());
    }
  }

  let command_name = Path::new(&command)
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or(&command);
  
  let is_standard = ALLOWED_AGENT_COMMANDS.contains(&command_name);
  let is_network = NETWORK_COMMANDS.contains(&command_name);
  
  if !is_standard && !is_network {
    return Err(format!(
      "command '{}' is not in the agent allowlist; allowed: {}",
      command_name,
      ALLOWED_AGENT_COMMANDS.iter().chain(NETWORK_COMMANDS.iter()).cloned().collect::<Vec<_>>().join(", ")
    ));
  }
  
  if is_network {
    return Err(format!(
      "network command '{}' requires SecureExecutor approval; use secureExecutor.runCommand() instead of terminal.runAgentCommand()",
      command_name
    ));
  }

  let mut child_command = Command::new(command);
  child_command.args(args);
  if let Some(path) = cwd {
    child_command.current_dir(path);
  }
  child_command.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
  let mut child = child_command.spawn().map_err(|error| error.to_string())?;
  attach_reader(&app, session_id.clone(), child.stdout.take());
  attach_reader(&app, session_id.clone(), child.stderr.take());
  state
    .sessions
    .lock()
    .map_err(|_| "terminal state lock poisoned".to_string())?
    .entry(session_id.clone())
    .and_modify(|session| {
      session.child = Some(child);
      session.stdin = None;
    });
  attach_exit_watcher(&app, state.inner().clone(), session_id.clone());
  Ok(())
}

#[tauri::command]
pub fn terminal_write(
  state: State<'_, Arc<TerminalState>>,
  session_id: String,
  data: String,
) -> Result<(), String> {
  let mut sessions = state
    .sessions
    .lock()
    .map_err(|_| "terminal state lock poisoned".to_string())?;
  let session = sessions
    .get_mut(&session_id)
    .ok_or_else(|| "terminal session not found".to_string())?;
  if session.owner != TerminalOwner::User {
    return Err("the AI agent terminal is read-only from the UI".to_string());
  }
  let stdin = session
    .stdin
    .as_mut()
    .ok_or_else(|| "terminal stdin is not available".to_string())?;
  stdin
    .write_all(data.as_bytes())
    .and_then(|_| stdin.flush())
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn terminal_kill(
  state: State<'_, Arc<TerminalState>>,
  session_id: String,
) -> Result<(), String> {
  let mut sessions = state
    .sessions
    .lock()
    .map_err(|_| "terminal state lock poisoned".to_string())?;
  let session = sessions
    .get_mut(&session_id)
    .ok_or_else(|| "terminal session not found".to_string())?;
  if let Some(child) = session.child.as_mut() {
    child.kill().map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[tauri::command]
pub fn terminal_resize(
  _session_id: String,
  _cols: u16,
  _rows: u16,
) -> Result<(), String> {
  Ok(())
}

fn default_shell_command() -> Command {
  #[cfg(windows)]
  {
    let mut command = Command::new("powershell.exe");
    command.args(["-NoLogo", "-NoExit"]);
    command
  }
  #[cfg(not(windows))]
  {
    Command::new(std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string()))
  }
}

fn new_session_id(prefix: &str) -> String {
  let millis = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|duration| duration.as_millis())
    .unwrap_or_default();
  format!("{prefix}-{millis}-{}", std::process::id())
}

fn attach_reader<T: Read + Send + 'static>(app: &AppHandle, session_id: String, stream: Option<T>) {
  let Some(stream) = stream else {
    return;
  };
  let app_handle = app.clone();
  thread::spawn(move || {
    let mut reader = BufReader::new(stream);
    let mut buffer = [0_u8; 4096];
    loop {
      match reader.read(&mut buffer) {
        Ok(0) => break,
        Ok(bytes) => {
          let data = String::from_utf8_lossy(&buffer[..bytes]).to_string();
          let _ = app_handle.emit(
            "terminal:data",
            TerminalDataPayload {
              session_id: session_id.clone(),
              data,
            },
          );
        }
        Err(_) => break,
      }
    }
  });
}

fn attach_exit_watcher(app: &AppHandle, state: Arc<TerminalState>, session_id: String) {
  let app_handle = app.clone();
  thread::spawn(move || {
    let code = loop {
      thread::sleep(std::time::Duration::from_millis(200));
      let status = {
        let mut sessions = match state.sessions.lock() {
          Ok(sessions) => sessions,
          Err(_) => return,
        };
        let Some(session) = sessions.get_mut(&session_id) else {
          return;
        };
        let Some(child) = session.child.as_mut() else {
          return;
        };
        child.try_wait()
      };
      match status {
        Ok(Some(status)) => break status.code(),
        Ok(None) => continue,
        Err(_) => break None,
      }
    };
    if let Ok(mut sessions) = state.sessions.lock() {
      if let Some(session) = sessions.get_mut(&session_id) {
        session.child = None;
        session.stdin = None;
      }
    }
    let _ = app_handle.emit(
      "terminal:exit",
      TerminalExitPayload {
        session_id,
        code,
      },
    );
  });
}
