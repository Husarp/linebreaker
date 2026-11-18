#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, io::Write, sync::Mutex};
use tauri::Manager;

struct SaveLock(Mutex<()>);
fn save_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}
#[tauri::command]
fn load_save(app: tauri::AppHandle, lock: tauri::State<SaveLock>) -> Result<Option<String>, String> {
    let _guard = lock.0.lock().map_err(|e| e.to_string())?;
    let dir = save_dir(&app)?;
    let path = dir.join("save.json");
    if !path.exists() { return Ok(None); }
    let read = |path| -> Result<String, String> {
        let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
        Ok(json)
    };
    read(path).or_else(|_| read(dir.join("save.bak"))).map(Some)
}
#[tauri::command]
fn write_save(app: tauri::AppHandle, lock: tauri::State<SaveLock>, json: String) -> Result<(), String> {
    let _guard = lock.0.lock().map_err(|e| e.to_string())?;
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let dir = save_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let save = dir.join("save.json");
    let temp = dir.join("save.tmp");
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    if save.exists() && fs::read_to_string(&save).ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()).is_some() {
        // Stage backup before replacing it, so a failed copy preserves the old backup.
        let backup_temp = dir.join("save.bak.tmp");
        fs::copy(&save, &backup_temp).map_err(|e| e.to_string())?;
        fs::rename(backup_temp, dir.join("save.bak")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, save).map_err(|e| e.to_string())
}
fn main() {
    tauri::Builder::default()
        .manage(SaveLock(Mutex::new(())))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_save, write_save])
        .run(tauri::generate_context!())
        .expect("Failed to run Linebreaker");
}
