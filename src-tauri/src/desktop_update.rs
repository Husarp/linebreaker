use serde_json::{json, Value};
use std::{fs, io::Write, path::PathBuf, process, sync::Mutex, time::Duration};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct PendingUpdate(Mutex<Pending>);

#[derive(Default)]
struct Pending {
    available: Option<Update>,
    verified: Option<(String, Vec<u8>)>,
    downloading: bool,
}

pub struct SmokeTest(pub Option<PathBuf>);

#[tauri::command]
pub fn desktop_smoke_ready(app: AppHandle, smoke: State<SmokeTest>, ready: bool) -> Result<bool, String> {
    let Some(path) = &smoke.0 else { return Ok(false) };
    if !ready {
        app.exit(1);
        return Err("Bundled game did not initialize".into());
    }
    fs::write(path, app.package_info().version.to_string()).map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(true)
}

#[tauri::command]
pub fn desktop_update_info(app: AppHandle) -> Value {
    let releases = app.config().plugins.0.get("updater")
        .and_then(|updater| updater["endpoints"][0].as_str())
        .and_then(|endpoint| endpoint.strip_suffix("/latest/download/latest.json"));
    json!({ "enabled": cfg!(target_os = "windows") && releases.is_some(),
        "version": app.package_info().version.to_string(), "releases": releases })
}

#[tauri::command]
pub async fn check_desktop_update(app: AppHandle, state: State<'_, PendingUpdate>) -> Result<Option<Value>, String> {
    if !cfg!(target_os = "windows") { return Ok(None); }
    let update = app.updater_builder().timeout(Duration::from_secs(10)).build()
        .map_err(|error| error.to_string())?.check().await.map_err(|error| error.to_string())?;
    let info = update.as_ref().map(|update| {
        if update.download_url.scheme() != "https" || !update.download_url.path().to_ascii_lowercase().ends_with(".exe") {
            return Err("Expected an HTTPS Windows setup executable".to_string());
        }
        let size = update.raw_json["platforms"].as_object().and_then(|platforms| {
            platforms.values().find(|platform| platform["url"].as_str() == Some(update.download_url.as_str()))
        }).and_then(|platform| platform["size"].as_u64());
        Ok(json!({ "version": update.version, "size": size, "notes": update.body }))
    }).transpose()?;
    state.0.lock().map_err(|error| error.to_string())?.available = update;
    Ok(info)
}

#[tauri::command]
pub async fn download_desktop_update(state: State<'_, PendingUpdate>, version: String, on_progress: Channel<Value>) -> Result<(), String> {
    let mut update = {
        let mut pending = state.0.lock().map_err(|error| error.to_string())?;
        if pending.downloading { return Err("A download is already running".into()); }
        if pending.verified.as_ref().is_some_and(|(cached, _)| cached == &version) { return Ok(()); }
        let update = pending.available.clone().filter(|update| update.version == version)
            .ok_or("This update is no longer available")?;
        pending.downloading = true;
        update
    };
    update.timeout = Some(Duration::from_secs(600));
    let mut done = 0u64;
    let mut last_progress = None;
    let result = update.download(|chunk, total| {
        done += chunk as u64;
        if last_progress.is_none_or(|time: std::time::Instant| time.elapsed() >= Duration::from_millis(100)) || total == Some(done) {
            let _ = on_progress.send(json!({ "done": done, "total": total }));
            last_progress = Some(std::time::Instant::now());
        }
    }, || {}).await;
    let mut pending = state.0.lock().map_err(|error| error.to_string())?;
    pending.downloading = false;
    pending.verified = Some((version, result.map_err(|error| error.to_string())?));
    Ok(())
}

fn cache_dir(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_cache_dir()?.join("updater"))
}

#[tauri::command]
pub async fn restart_desktop(app: AppHandle) -> Result<(), String> {
    if !cfg!(target_os = "windows") { return Err("Desktop restart is only available on Windows".into()); }
    app.restart()
}

#[tauri::command]
pub async fn install_desktop_update(app: AppHandle, state: State<'_, PendingUpdate>, version: String) -> Result<(), String> {
    if !cfg!(target_os = "windows") { return Err("Updates are only available on Windows".into()); }
    let mut pending = state.0.lock().map_err(|error| error.to_string())?;
    let (_, bytes) = pending.verified.as_ref().filter(|(cached, _)| cached == &version)
        .ok_or("No verified installer is ready")?;
    let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?.as_nanos();
    let staging = cache_dir(&app).map_err(|error| error.to_string())?.join(format!("setup-{}-{nonce}", process::id()));
    let installer = staging.join(format!("LinebreakerSetup-{version}.exe"));
    fs::create_dir_all(&staging).map_err(|error| error.to_string())?;
    let launch = (|| {
        let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&installer)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        process::Command::new(&installer).arg("--update").arg(process::id().to_string()).spawn()
    })();
    if let Err(error) = launch {
        let _ = fs::remove_dir_all(staging);
        return Err(error.to_string());
    }
    pending.verified = None;
    app.exit(0);
    Ok(())
}

pub fn clean_old_installers(app: &AppHandle) {
    if !cfg!(target_os = "windows") { return; }
    let Ok(cache) = cache_dir(app) else { return };
    std::thread::spawn(move || {
        let Ok(entries) = fs::read_dir(cache) else { return };
        let mut paths: Vec<_> = entries.flatten().filter(|entry| {
            entry.file_name().to_string_lossy().starts_with("setup-") && entry.file_type().is_ok_and(|kind| kind.is_dir())
        }).map(|entry| entry.path()).collect();
        for _ in 0..30 {
            paths.retain(|path| fs::remove_dir_all(path).is_err_and(|error| error.kind() != std::io::ErrorKind::NotFound));
            if paths.is_empty() { break; }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
