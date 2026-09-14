fn main() {
    // The window loads a REMOTE page (weered.ca). Tauri 2 only lets a remote
    // origin call app commands that are declared here and granted in
    // capabilities/default.json. With a bare tauri_build::build() every invoke
    // from the site failed with "<cmd> not allowed. Plugin not found": the tray
    // unread dot never updated, and the BAR launcher could not run at all.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "cmd_show_window",
            "cmd_quit",
            "cmd_get_version",
            "cmd_set_unread",
            "cmd_bar_status",
            "cmd_bar_set_dir",
            "cmd_bar_launch",
        ]),
    ))
    .expect("failed to run tauri-build");
}
