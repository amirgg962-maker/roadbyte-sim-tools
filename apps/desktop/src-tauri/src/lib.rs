#![allow(dead_code)]

pub mod commands;
pub mod core;
pub mod save_parser;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .manage(commands::read_only::ReadOnlyState::default())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::profile::list_profiles,
            commands::profile::get_saves,
            commands::profile::delete_profile,
            commands::read_only::set_read_only,
            commands::save::load_save,
            commands::save::edit_save,
            commands::save::unlock_cities,
            commands::save::max_skills,
            commands::save::repair_all,
            commands::save::refuel_all,
            commands::manage::rename_save,
            commands::manage::clone_save,
            commands::manage::delete_save,
            commands::backups::list_backups,
            commands::backups::verify_backup,
            commands::backups::restore_backup,
            commands::backups::delete_backup,
            commands::config::list_configs,
            commands::config::load_config,
            commands::config::save_config,
            commands::config::set_text_save_format,
            commands::config::get_app_info,
        ]);

    #[allow(clippy::expect_used)]
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
