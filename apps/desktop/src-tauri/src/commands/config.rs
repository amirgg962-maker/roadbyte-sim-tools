use std::path::Path;

use serde::Serialize;

use crate::core::backup::backup_file;
use crate::core::compatibility::APP_VERSION;
use crate::core::detection::{find_config_files_for_game, game_by_id, GameType};
use crate::save_parser::config::{ConfigDocument, ConfigEntry};

use super::EditResult;

#[derive(Serialize)]
pub struct AppVersionInfo {
    pub app_version: String,
    pub game_version: Option<String>,
    pub tested_game_version: String,
    pub compatibility_warning: Option<String>,
}

#[tauri::command]
pub fn get_app_info(
    game_id: Option<String>,
    custom_path: Option<String>,
) -> Result<AppVersionInfo, String> {
    let game_id = game_id.as_deref().unwrap_or("ets2");
    let game = game_by_id(game_id).ok_or_else(|| format!("Unsupported game id: {game_id}"))?;
    let custom_p = custom_path
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(Path::new);
    let (game_version, compatibility_warning) =
        super::helpers::read_game_version_for_game(custom_p, game.game_type);
    Ok(AppVersionInfo {
        app_version: APP_VERSION.to_string(),
        game_version,
        tested_game_version: if game.game_type == GameType::Ats {
            "Not validated".into()
        } else {
            crate::core::compatibility::TESTED_GAME_VERSION.to_display()
        },
        compatibility_warning,
    })
}

#[tauri::command]
pub fn list_configs(
    game_id: Option<String>,
    custom_path: Option<String>,
) -> Result<Vec<String>, String> {
    let game_id = game_id.as_deref().unwrap_or("ets2");
    let game_type =
        GameType::from_id(game_id).ok_or_else(|| format!("Unsupported game id: {game_id}"))?;
    let custom_p = custom_path
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(Path::new);
    let configs = find_config_files_for_game(custom_p, game_type);
    Ok(configs
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn load_config(path: String, custom_path: Option<String>) -> Result<ConfigDocument, String> {
    let file_path = Path::new(&path);
    validate_config_path(file_path, custom_path.as_deref())?;
    let content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let doc = ConfigDocument::parse(&content);
    Ok(doc)
}

#[tauri::command]
pub fn save_config(
    path: String,
    entries: Vec<ConfigEntry>,
    expected_entries: Vec<ConfigEntry>,
    custom_path: Option<String>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;

    let file_path = Path::new(&path);
    validate_config_path(file_path, custom_path.as_deref())?;
    let original = std::fs::read_to_string(file_path).map_err(|error| error.to_string())?;
    let content = ConfigDocument::update_text_if_unchanged(&original, &expected_entries, &entries)?;
    let backup = backup_file(file_path).map_err(|e| e.to_string())?;
    crate::core::atomic_file::write_atomic(file_path, content.as_bytes())
        .map_err(|error| error.to_string())?;

    let message = format!(
        "Config saved; its backup is stored beside config.cfg at {}",
        backup.display()
    );
    Ok(EditResult {
        message,
        backup: Some(backup.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub fn set_text_save_format(
    path: String,
    custom_path: Option<String>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;

    set_text_save_format_for_config(Path::new(&path), custom_path.as_deref())
}

fn set_text_save_format_for_config(
    file_path: &Path,
    custom_path: Option<&str>,
) -> Result<EditResult, String> {
    validate_config_path(file_path, custom_path)?;
    let original = std::fs::read_to_string(file_path).map_err(|error| error.to_string())?;
    let content = text_save_format_config_content(&original)?;

    if content == original {
        return Ok(EditResult {
            message: "Text save format is already enabled. Load and save this save in ETS2 to convert it.".into(),
            backup: None,
        });
    }

    let backup = backup_file(file_path).map_err(|error| error.to_string())?;
    crate::core::atomic_file::write_atomic(file_path, content.as_bytes())
        .map_err(|error| error.to_string())?;

    Ok(EditResult {
        message: format!(
            "Text save format enabled. Close and reopen ETS2, then load and save this save in-game to convert it. Config backup: {}",
            backup.display()
        ),
        backup: Some(backup.to_string_lossy().to_string()),
    })
}

fn text_save_format_config_content(original: &str) -> Result<String, String> {
    let mut document = ConfigDocument::parse(original);
    let mut found = false;
    for entry in &mut document.entries {
        if entry.key == "g_save_format" {
            entry.value = "2".into();
            found = true;
        }
    }

    if found {
        return ConfigDocument::update_text(original, &document.entries);
    }

    let newline = if original.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let mut updated = original.to_string();
    let had_final_newline = original.ends_with('\n');
    if !updated.is_empty() && !had_final_newline {
        updated.push_str(newline);
    }
    updated.push_str("uset g_save_format \"2\"");
    if had_final_newline {
        updated.push_str(newline);
    }
    Ok(updated)
}

fn validate_config_path(path: &Path, custom_path: Option<&str>) -> Result<(), String> {
    if !path.is_file() || path.file_name().and_then(|name| name.to_str()) != Some("config.cfg") {
        return Err("Only an existing config.cfg file can be saved".into());
    }
    if std::fs::symlink_metadata(path)
        .map_err(|error| error.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("Config file must not be a symlink".into());
    }

    let canonical_path = path.canonicalize().map_err(|error| error.to_string())?;
    let custom_path = custom_path
        .filter(|value| !value.trim().is_empty())
        .map(Path::new);
    let is_listed = crate::core::detection::find_config_files(custom_path)
        .into_iter()
        .filter_map(|candidate| candidate.canonicalize().ok())
        .any(|candidate| candidate == canonical_path);
    if !is_listed {
        return Err("Config file is not in a detected game config location".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_config_outside_detected_locations() {
        let directory = tempfile::tempdir().unwrap();
        let unrelated = directory.path().join("unlisted").join("config.cfg");
        std::fs::create_dir_all(unrelated.parent().unwrap()).unwrap();
        std::fs::write(&unrelated, "uset r_test \"1\"\n").unwrap();

        assert!(validate_config_path(&unrelated, None).is_err());
    }

    #[test]
    fn load_config_rejects_path_outside_detected_and_custom_locations() {
        let directory = tempfile::tempdir().unwrap();
        let unrelated = directory.path().join("unlisted").join("config.cfg");
        std::fs::create_dir_all(unrelated.parent().unwrap()).unwrap();
        std::fs::write(&unrelated, "uset r_test \"1\"\n").unwrap();

        let result = load_config(unrelated.to_string_lossy().into_owned(), None);

        assert!(result.is_err());
    }

    #[test]
    fn accepts_config_in_user_selected_game_location() {
        let directory = tempfile::tempdir().unwrap();
        let game_path = directory.path().join("custom-game");
        std::fs::create_dir_all(&game_path).unwrap();
        let config = game_path.join("config.cfg");
        std::fs::write(&config, "uset r_test \"1\"\n").unwrap();

        validate_config_path(&config, Some(game_path.to_str().unwrap())).unwrap();
    }

    #[test]
    fn enables_text_save_format_without_changing_other_config_lines() {
        let original =
            "# keep this comment\r\nuset g_save_format \"1\"\r\nuset r_scale \"1.0\"\r\n";

        let updated = text_save_format_config_content(original).unwrap();

        assert_eq!(
            updated,
            "# keep this comment\r\nuset g_save_format \"2\"\r\nuset r_scale \"1.0\"\r\n"
        );
    }

    #[test]
    fn appends_text_save_format_when_setting_is_missing() {
        let original = "# game settings\r\nuset r_scale \"1.0\"\r\n";

        let updated = text_save_format_config_content(original).unwrap();

        assert_eq!(
            updated,
            "# game settings\r\nuset r_scale \"1.0\"\r\nuset g_save_format \"2\"\r\n"
        );
    }

    #[test]
    fn updates_all_duplicate_text_save_format_settings() {
        let original = "uset g_save_format \"1\"\nuset g_save_format \"0\"\n";

        let updated = text_save_format_config_content(original).unwrap();

        assert_eq!(
            updated,
            "uset g_save_format \"2\"\nuset g_save_format \"2\"\n"
        );
    }

    #[test]
    fn enabling_text_format_backs_up_config_and_does_not_touch_save_files() {
        let directory = tempfile::tempdir().unwrap();
        let game_path = directory.path().join("custom-game");
        std::fs::create_dir_all(&game_path).unwrap();
        let config_path = game_path.join("config.cfg");
        let save_path = game_path.join("save").join("slot").join("game.sii");
        std::fs::create_dir_all(save_path.parent().unwrap()).unwrap();
        std::fs::write(
            &config_path,
            "uset g_save_format \"1\"\nuset r_scale \"1.0\"\n",
        )
        .unwrap();
        std::fs::write(&save_path, b"BSII save bytes").unwrap();

        let result = set_text_save_format_for_config(&config_path, game_path.to_str()).unwrap();

        assert_eq!(
            std::fs::read_to_string(&config_path).unwrap(),
            "uset g_save_format \"2\"\nuset r_scale \"1.0\"\n"
        );
        let backup = result.backup.expect("config backup should be reported");
        assert_eq!(
            std::fs::read_to_string(backup).unwrap(),
            "uset g_save_format \"1\"\nuset r_scale \"1.0\"\n"
        );
        assert_eq!(std::fs::read(&save_path).unwrap(), b"BSII save bytes");
    }

    #[test]
    fn already_enabled_text_format_does_not_create_an_unneeded_backup() {
        let directory = tempfile::tempdir().unwrap();
        let game_path = directory.path().join("custom-game");
        std::fs::create_dir_all(&game_path).unwrap();
        let config_path = game_path.join("config.cfg");
        let original = "uset g_save_format \"2\"\n";
        std::fs::write(&config_path, original).unwrap();

        let result = set_text_save_format_for_config(&config_path, game_path.to_str()).unwrap();

        assert!(result.backup.is_none());
        assert_eq!(std::fs::read_to_string(config_path).unwrap(), original);
    }
}
