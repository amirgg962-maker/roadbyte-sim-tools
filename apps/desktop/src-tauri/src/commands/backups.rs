use crate::core::backups::{self, BackupActionResult, BackupEntry};

#[tauri::command]
pub fn list_backups(
    profile_paths: Vec<String>,
    custom_path: Option<String>,
) -> Result<Vec<BackupEntry>, String> {
    backups::list_backups(&profile_paths, custom_path.as_deref())
}

#[tauri::command]
pub fn restore_backup(
    backup_path: String,
    profile_paths: Vec<String>,
    custom_path: Option<String>,
    _read_only: bool,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<BackupActionResult, String> {
    backups::restore_backup(
        &backup_path,
        &profile_paths,
        custom_path.as_deref(),
        state.is_read_only(),
    )
}

#[tauri::command]
pub fn delete_backup(
    backup_path: String,
    profile_paths: Vec<String>,
    custom_path: Option<String>,
    _read_only: bool,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<BackupActionResult, String> {
    backups::delete_backup(
        &backup_path,
        &profile_paths,
        custom_path.as_deref(),
        state.is_read_only(),
    )
}
