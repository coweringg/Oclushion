mod keychain;
mod terminal;
mod llm;

use std::sync::Arc;
use terminal::TerminalState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(Arc::new(TerminalState::default()))
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      terminal::terminal_spawn_user,
      terminal::terminal_spawn_agent,
      terminal::terminal_run_agent_command,
      terminal::terminal_write,
      terminal::terminal_kill,
      terminal::terminal_resize,
      keychain::save_api_key,
      keychain::load_api_key,
      keychain::delete_api_key,
      keychain::load_all_keys,
      llm::llm_generate,
      llm::llm_stream,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
