// Weered desktop shell — Tauri 2 + Rust.
// Loads weered.ca in a native webview, adds a system tray, global hotkey,
// single-instance + deep link handling, autostart toggle, and window-state
// persistence.

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray.png");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        // Single instance: focus existing window if user re-launches the app
        // and forward any deep-link arguments to the running instance.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Bring the main window forward.
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            // Forward deep-link URLs (weered://) that came in on launch args.
            for arg in args.iter().skip(1) {
                if arg.starts_with("weered://") {
                    let _ = app.emit("deep-link", arg);
                    let _ = navigate_to_path(app, arg);
                }
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ));

    // Global shortcut: Ctrl+Shift+W (Cmd+Shift+W on macOS) to focus Weered.
    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed
                        && shortcut.matches(Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyW)
                    {
                        toggle_main_window(app);
                    }
                })
                .build(),
        );
    }

    builder
        .setup(|app| {
            // Build the system tray.
            build_tray(app.handle())?;

            // Register the global shortcut.
            #[cfg(desktop)]
            {
                let shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyW);
                let _ = app.global_shortcut().register(shortcut);
            }

            // Register deep-link handler so weered:// URLs route into the app.
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }

            // Hide-on-close: closing the window minimizes to tray instead of
            // killing the process. User explicitly quits via tray menu.
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let _ = win_clone.hide();
                        api.prevent_close();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_show_window,
            cmd_quit,
            cmd_get_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Weered desktop");
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItemBuilder::with_id("open", "Open Weered").build(app)?;
    let home = MenuItemBuilder::with_id("home", "Home").build(app)?;
    let lobbies = MenuItemBuilder::with_id("lobbies", "Lobbies").build(app)?;
    let dms = MenuItemBuilder::with_id("dms", "Direct Messages").build(app)?;
    let crews = MenuItemBuilder::with_id("crews", "Crews").build(app)?;

    let nav = SubmenuBuilder::new(app, "Jump to")
        .item(&home)
        .item(&lobbies)
        .item(&dms)
        .item(&crews)
        .build()?;

    let about = MenuItemBuilder::with_id("about", "About Weered").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Weered").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open)
        .item(&nav)
        .separator()
        .item(&about)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&quit)
        .build()?;

    let tray_icon = Image::from_bytes(TRAY_ICON_BYTES)
        .unwrap_or_else(|_| Image::new(&[0u8; 4], 1, 1).to_owned());

    TrayIconBuilder::with_id("weered-tray")
        .icon(tray_icon)
        .icon_as_template(true)
        .tooltip("Weered")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => toggle_main_window(app),
            "home" => navigate(app, "/home"),
            "lobbies" => navigate(app, "/lobbies"),
            "dms" => navigate(app, "/dms"),
            "crews" => navigate(app, "/crews"),
            "about" => navigate(app, "/about"),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click toggles the main window.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) && win.is_focused().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.unminimize();
            let _ = win.set_focus();
        }
    }
}

fn navigate(app: &AppHandle, path: &str) {
    let url = format!("https://weered.ca{}", path);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = win.eval(&format!("window.location.href = {:?};", url));
    }
}

fn navigate_to_path(app: &AppHandle, deep_link: &str) -> tauri::Result<()> {
    // weered://lobby/123 → https://weered.ca/lobby/123
    let path = deep_link.strip_prefix("weered://").unwrap_or("");
    let url = format!("https://weered.ca/{}", path);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = win.eval(&format!("window.location.href = {:?};", url));
    }
    Ok(())
}

#[tauri::command]
fn cmd_show_window(app: AppHandle) {
    toggle_main_window(&app);
}

#[tauri::command]
fn cmd_quit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn cmd_get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
