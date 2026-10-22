use std::path::Path;

use super::EditResult;

#[tauri::command]
pub fn rename_save(
    game_sii_path: String,
    new_name: String,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let path = Path::new(&game_sii_path);
    let save_path = path
        .parent()
        .ok_or_else(|| "Invalid save path".to_string())?;

    crate::core::profile_ops::rename_save(save_path, &new_name).map_err(|e| e.to_string())?;

    Ok(EditResult {
        message: format!("Renamed save to '{}'", new_name),
        backup: None,
    })
}

#[tauri::command]
pub fn clone_save(
    game_sii_path: String,
    new_name: String,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let path = Path::new(&game_sii_path);
    let save_path = path
        .parent()
        .ok_or_else(|| "Invalid save path".to_string())?;

    crate::core::profile_ops::clone_save(save_path, &new_name).map_err(|e| e.to_string())?;

    Ok(EditResult {
        message: format!("Cloned save to '{}'", new_name),
        backup: None,
    })
}

#[tauri::command]
pub fn delete_save(
    game_sii_path: String,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let path = Path::new(&game_sii_path);
    let save_path = path
        .parent()
        .ok_or_else(|| "Invalid save path".to_string())?;

    let backup = crate::core::profile_ops::delete_save(save_path).map_err(|e| e.to_string())?;

    Ok(EditResult {
        message: format!("Save deleted. Full backup created at {}", backup.display()),
        backup: Some(backup.to_string_lossy().to_string()),
    })
}
