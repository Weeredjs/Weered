// Beyond All Reason launcher bridge.
//
// weered.ca (a remote page, allowed by capabilities/default.json) builds the
// engine start script for a room game and asks this process to run it. The
// page is trusted for the script's CONTENT only: the executable, its location,
// the write directory and every flag are decided here, never taken from the
// request. A start script can only name archives and AIs already installed
// locally, so the worst a bad script does is fail to start a game.

use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct BarStatus {
    found: bool,
    install_dir: Option<String>,
    engine: Option<String>,
    game: Option<String>,
    error: Option<String>,
}

struct Install {
    dir: PathBuf,
    data: PathBuf,
    engine: String,
    game: String,
    env: Vec<(String, String)>,
}

fn override_file(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("bar_install_dir.txt"))
}

fn candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Some(f) = override_file(app) {
        if let Ok(s) = std::fs::read_to_string(&f) {
            let t = s.trim();
            if !t.is_empty() {
                out.push(PathBuf::from(t));
            }
        }
    }
    // Where the official installer puts it, then where people unpack it by hand.
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        out.push(Path::new(&local).join("Programs").join("Beyond-All-Reason"));
    }
    for drive in ["C", "D", "E", "F", "G"] {
        out.push(PathBuf::from(format!("{drive}:\\Games\\Beyond-All-Reason")));
        out.push(PathBuf::from(format!("{drive}:\\Beyond-All-Reason")));
    }
    out
}

fn is_install(p: &Path) -> bool {
    p.join("data").join("config.json").is_file()
}

fn find_install(app: &AppHandle) -> Option<PathBuf> {
    candidates(app).into_iter().find(|p| is_install(p))
}

/// The launcher's own config names the engine build; the rapid index names the
/// current game version. Reading both means a BAR update never needs a Weered
/// release.
fn read_install(dir: &Path) -> Result<Install, String> {
    let data = dir.join("data");
    let text = std::fs::read_to_string(data.join("config.json")).map_err(|e| e.to_string())?;
    let cfg: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let setups = cfg
        .get("setups")
        .and_then(|s| s.as_array())
        .ok_or("BAR's config.json has no setups")?;
    let setup = setups
        .iter()
        .find(|s| s.pointer("/package/id").and_then(|v| v.as_str()) == Some("manual-win"))
        .or_else(|| {
            setups
                .iter()
                .find(|s| s.pointer("/package/platform").and_then(|v| v.as_str()) == Some("win32"))
        })
        .ok_or("BAR's config.json has no Windows setup")?;
    let engine = setup
        .pointer("/launch/engine")
        .and_then(|v| v.as_str())
        .ok_or("BAR's config.json names no engine")?
        .to_string();
    let mut env = Vec::new();
    if let Some(obj) = setup.get("env_variables").and_then(|v| v.as_object()) {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                env.push((k.clone(), s.to_string()));
            }
        }
    }
    let game = resolve_game(&data)?;
    Ok(Install {
        dir: dir.to_path_buf(),
        data,
        engine,
        game,
        env,
    })
}

fn resolve_game(data: &Path) -> Result<String, String> {
    let rapid = std::fs::read_dir(data.join("rapid"))
        .map_err(|_| "BAR hasn't finished downloading yet. Open it once and let it update.".to_string())?;
    for entry in rapid.flatten() {
        let index = entry.path().join("byar").join("versions.gz");
        if !index.is_file() {
            continue;
        }
        let file = std::fs::File::open(&index).map_err(|e| e.to_string())?;
        let mut text = String::new();
        flate2::read::GzDecoder::new(file)
            .read_to_string(&mut text)
            .map_err(|e| e.to_string())?;
        for line in text.lines() {
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 4 && parts[0] == "byar:test" {
                return Ok(parts[3].trim().to_string());
            }
        }
    }
    Err("Couldn't find BAR's current game version. Open BAR once and let it update.".into())
}

#[tauri::command]
pub fn cmd_bar_status(app: AppHandle) -> BarStatus {
    match find_install(&app) {
        None => BarStatus {
            found: false,
            install_dir: None,
            engine: None,
            game: None,
            error: None,
        },
        Some(dir) => match read_install(&dir) {
            Ok(i) => BarStatus {
                found: true,
                install_dir: Some(i.dir.display().to_string()),
                engine: Some(i.engine),
                game: Some(i.game),
                error: None,
            },
            Err(e) => BarStatus {
                found: true,
                install_dir: Some(dir.display().to_string()),
                engine: None,
                game: None,
                error: Some(e),
            },
        },
    }
}

#[tauri::command]
pub fn cmd_bar_set_dir(app: AppHandle, dir: String) -> Result<BarStatus, String> {
    let p = PathBuf::from(dir.trim());
    if !is_install(&p) {
        return Err(
            "That folder doesn't look like Beyond All Reason. Pick the one that contains the data folder."
                .into(),
        );
    }
    let f = override_file(&app).ok_or("Couldn't find Weered's settings folder.")?;
    if let Some(parent) = f.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&f, p.display().to_string()).map_err(|e| e.to_string())?;
    Ok(cmd_bar_status(app))
}

#[derive(Deserialize)]
pub struct LaunchReq {
    script: String,
    map: String,
}

fn valid_map(m: &str) -> bool {
    !m.is_empty()
        && m.len() <= 120
        && m.chars().all(|c| c.is_ascii_alphanumeric() || " _-.'()+&".contains(c))
}

#[tauri::command]
pub async fn cmd_bar_launch(app: AppHandle, req: LaunchReq) -> Result<u32, String> {
    let dir = find_install(&app)
        .ok_or("Weered can't find Beyond All Reason on this PC. Set its folder first.")?;
    let inst = read_install(&dir)?;

    if req.script.len() > 64_000 || req.script.contains('\0') || !req.script.trim_start().starts_with("[GAME]") {
        return Err("Refusing a malformed start script.".into());
    }
    if !valid_map(&req.map) {
        return Err("Refusing an invalid map name.".into());
    }

    // Fetch the map if this PC doesn't have it. Same downloader and endpoints
    // BAR's own launcher uses; a failure here is not fatal, the engine reports
    // a missing map itself.
    let prd = inst.dir.join("bin").join("pr-downloader.exe");
    if prd.is_file() {
        let mut cmd = Command::new(&prd);
        cmd.arg("--filesystem-writepath")
            .arg(&inst.data)
            .arg("--download-map")
            .arg(&req.map)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        for (k, v) in &inst.env {
            cmd.env(k, v);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let _ = tauri::async_runtime::spawn_blocking(move || cmd.status()).await;
    }

    let script_path = inst.data.join("weered_script.txt");
    std::fs::write(&script_path, &req.script).map_err(|e| format!("Couldn't write the start script: {e}"))?;

    let exe = inst.data.join("engine").join(&inst.engine).join("spring.exe");
    if !exe.is_file() {
        return Err(format!(
            "Engine {} isn't downloaded yet. Open BAR once and let it update.",
            inst.engine
        ));
    }
    let _ = &inst.game; // resolved for cmd_bar_status; the page writes it into the script

    let child = Command::new(&exe)
        .arg("--write-dir")
        .arg(&inst.data)
        .arg("--window")
        .arg(&script_path)
        .current_dir(exe.parent().unwrap_or(&inst.data))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Couldn't start Beyond All Reason: {e}"))?;
    Ok(child.id())
}

/// Ctrl+Shift+F8: flip the room screen share from inside a game, no alt-tab.
pub fn emit_share_toggle(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.eval("window.dispatchEvent(new CustomEvent('weered:share-toggle'))");
    }
}
