use std::path::Path;

use crate::core::backup::backup_file;
use crate::save_parser::{
    compression::{decompress_save, read_save_file},
    editor::get_trucks_info,
    editor::SaveEditor,
    sii::SiiDocument,
};

use super::helpers::{calc_level, read_info_sii, save_file_from_game_sii};
use super::{EditResult, SaveData};
use crate::core::detection::GameType;

fn maybe_create_backup(
    path: &Path,
    create_backup: Option<bool>,
) -> Result<Option<std::path::PathBuf>, String> {
    if create_backup.unwrap_or(true) {
        backup_file(path)
            .map(Some)
            .map_err(|error| error.to_string())
    } else {
        Ok(None)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod backup_option_tests {
    use super::maybe_create_backup;
    use std::fs;

    #[test]
    fn disabled_backup_does_not_create_backup_files() {
        let directory = tempfile::tempdir().unwrap();
        let save_path = directory.path().join("game.sii");
        fs::write(&save_path, b"save").unwrap();

        assert!(maybe_create_backup(&save_path, Some(false))
            .unwrap()
            .is_none());
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
        assert_eq!(fs::read(&save_path).unwrap(), b"save");
    }

    #[test]
    fn omitted_backup_option_keeps_safe_default() {
        let directory = tempfile::tempdir().unwrap();
        let save_path = directory.path().join("game.sii");
        fs::write(&save_path, b"save").unwrap();

        let backup = maybe_create_backup(&save_path, None).unwrap().unwrap();
        assert_eq!(fs::read(backup).unwrap(), b"save");
    }
}

#[tauri::command]
pub fn load_save(game_id: Option<String>, game_sii_path: String) -> Result<SaveData, String> {
    let game_id = game_id.as_deref().unwrap_or("ets2");
    let game_type =
        GameType::from_id(game_id).ok_or_else(|| format!("Unsupported game id: {game_id}"))?;
    let data = read_save_file(Path::new(&game_sii_path)).map_err(|e| e.to_string())?;
    let was_compressed = data.len() >= 4 && &data[..4] == b"ScsC";
    let content = decompress_save(&data).map_err(|e| e.to_string())?;

    let doc = SiiDocument::new(content);

    // Match ETS Vibes: save layouts vary, so locate account fields by property
    // name rather than requiring a specific unit header.
    let money_account = doc.get_property("money_account").map(str::to_string);
    // ETS Vibes reads the player XP by property name because real save layouts
    // use different unit headers across versions. Keep that compatibility:
    // restricting this to `driver_player` made XP disappear on valid saves.
    let experience_points = doc.get_property("experience_points").map(str::to_string);

    let money = money_account.as_ref().and_then(|s| s.parse::<i64>().ok());
    let xp = experience_points
        .as_ref()
        .and_then(|s| s.parse::<i64>().ok());

    let computed_level = xp.map(calc_level);

    let trucks_count = doc
        .get_property("trucks")
        .and_then(|s| s.parse::<u32>().ok());

    let drivers_count = doc
        .get_property("drivers")
        .and_then(|s| s.parse::<u32>().ok());

    let hq_city = doc.get_property("hq_city").map(|s| s.to_string());

    let trucks = get_trucks_info(doc.content()).map_err(|e| e.to_string())?;

    let game_time = doc
        .get_property("game_time")
        .and_then(|s| s.parse::<i64>().ok());

    let total_distance_km = doc
        .get_property("total_distance")
        .and_then(|s| s.parse::<f64>().ok());

    let total_fuel_litres = doc
        .get_property("total_fuel_litres")
        .and_then(|s| s.parse::<f64>().ok());

    let visited_cities_count = doc
        .get_property("visited_cities_count")
        .and_then(|s| s.parse::<u32>().ok());

    let achieved_feats = doc
        .get_property("achieved_feats")
        .and_then(|s| s.parse::<u32>().ok());

    let new_game = doc.get_property("new_game").map(|s| s == "true");

    let discovered_items = doc
        .get_property("discovered_items")
        .and_then(|s| s.parse::<u32>().ok());

    let save_path = Path::new(&game_sii_path).parent().unwrap_or(Path::new(""));
    let (save_version, file_time, mods) = read_info_sii(save_path)?;

    let mut custom_config_path = None;
    let mut curr = Some(save_path);
    while let Some(dir) = curr {
        if dir.join("config.cfg").exists() {
            custom_config_path = Some(dir);
            break;
        }
        curr = dir.parent();
    }

    let (game_version, compatibility_warning) =
        super::helpers::read_game_version_for_game(custom_config_path, game_type);

    Ok(SaveData {
        money,
        xp,
        level: computed_level,
        trucks_count,
        drivers_count,
        hq_city,
        trucks,
        money_account,
        experience_points,
        was_compressed,
        game_time,
        total_distance_km,
        total_fuel_litres,
        visited_cities_count,
        achieved_feats,
        new_game,
        discovered_items,
        save_version,
        file_time,
        mods,
        game_version,
        compatibility_warning,
    })
}

#[tauri::command]
pub fn edit_save(
    game_sii_path: String,
    money: Option<i64>,
    xp: Option<i64>,
    create_backup: Option<bool>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let file_path = Path::new(&game_sii_path);
    let save_file = save_file_from_game_sii(&game_sii_path)?;

    let mut editor = SaveEditor::new(save_file);
    editor.load().map_err(|e| e.to_string())?;

    let mut changes = Vec::new();

    if let Some(amount) = money {
        if editor.edit_money(amount).map_err(|e| e.to_string())? {
            changes.push(format!("money -> {}", amount));
        }
    }

    if let Some(xp_val) = xp {
        if editor.edit_xp(xp_val).map_err(|e| e.to_string())? {
            changes.push(format!("xp -> {}", xp_val));
        }
    }

    let backup = if changes.is_empty() {
        None
    } else {
        let bp = maybe_create_backup(file_path, create_backup)?;
        editor.save().map_err(|e| e.to_string())?;
        bp.map(|path| path.to_string_lossy().to_string())
    };

    let message = backup.as_ref().map_or_else(
        || {
            if changes.is_empty() {
                "No changes made.".into()
            } else {
                "Saved.".into()
            }
        },
        |b| format!("Saved (backup: {})", b),
    );

    Ok(EditResult { message, backup })
}

#[tauri::command]
pub fn max_skills(
    game_sii_path: String,
    create_backup: Option<bool>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let file_path = Path::new(&game_sii_path);
    let save_file = save_file_from_game_sii(&game_sii_path)?;

    let mut editor = SaveEditor::new(save_file);
    editor.load().map_err(|e| e.to_string())?;
    let changes = editor.max_skills().map_err(|e| e.to_string())?;

    let (message, backup) = if changes.is_empty() {
        ("Skills already maxed.".into(), None)
    } else {
        let bp = maybe_create_backup(file_path, create_backup)?;
        editor.save().map_err(|e| e.to_string())?;
        let message = bp.as_ref().map_or_else(
            || "Skills maxed.".into(),
            |path| format!("Skills maxed (backup: {})", path.display()),
        );
        (message, bp.map(|path| path.to_string_lossy().to_string()))
    };

    Ok(EditResult { message, backup })
}

#[tauri::command]
pub fn repair_all(
    game_sii_path: String,
    create_backup: Option<bool>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let file_path = Path::new(&game_sii_path);
    let save_file = save_file_from_game_sii(&game_sii_path)?;

    let mut editor = SaveEditor::new(save_file);
    editor.load().map_err(|e| e.to_string())?;
    let changes = editor.repair_all().map_err(|e| e.to_string())?;

    let (message, backup) = if changes.is_empty() {
        ("Everything already repaired.".into(), None)
    } else {
        let bp = maybe_create_backup(file_path, create_backup)?;
        editor.save().map_err(|e| e.to_string())?;
        let message = bp.as_ref().map_or_else(
            || format!("Repaired: {}", changes.join(", ")),
            |path| {
                format!(
                    "Repaired: {} (backup: {})",
                    changes.join(", "),
                    path.display()
                )
            },
        );
        (message, bp.map(|path| path.to_string_lossy().to_string()))
    };

    Ok(EditResult { message, backup })
}

#[tauri::command]
pub fn refuel_all(
    game_sii_path: String,
    create_backup: Option<bool>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let file_path = Path::new(&game_sii_path);
    let save_file = save_file_from_game_sii(&game_sii_path)?;

    let mut editor = SaveEditor::new(save_file);
    editor.load().map_err(|e| e.to_string())?;
    let changes = editor.refuel_all().map_err(|e| e.to_string())?;

    let (message, backup) = if changes.is_empty() {
        ("Everything already refueled.".into(), None)
    } else {
        let bp = maybe_create_backup(file_path, create_backup)?;
        editor.save().map_err(|e| e.to_string())?;
        let message = bp.as_ref().map_or_else(
            || "Refueled.".into(),
            |path| format!("Refueled (backup: {})", path.display()),
        );
        (message, bp.map(|path| path.to_string_lossy().to_string()))
    };

    Ok(EditResult { message, backup })
}

#[tauri::command]
pub fn unlock_cities(
    game_sii_path: String,
    create_backup: Option<bool>,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<EditResult, String> {
    state.ensure_writable()?;
    let file_path = Path::new(&game_sii_path);
    let save_file = save_file_from_game_sii(&game_sii_path)?;

    let mut editor = SaveEditor::new(save_file);
    editor.load().map_err(|e| e.to_string())?;
    let count = editor.unlock_all_cities().map_err(|e| e.to_string())?;

    let (message, backup) = if count > 0 {
        let bp = maybe_create_backup(file_path, create_backup)?;
        editor.save().map_err(|e| e.to_string())?;
        let message = bp.as_ref().map_or_else(
            || format!("Unlocked {} cities.", count),
            |path| format!("Unlocked {} cities (backup: {})", count, path.display()),
        );
        (message, bp.map(|path| path.to_string_lossy().to_string()))
    } else {
        ("No new cities to unlock.".into(), None)
    };

    Ok(EditResult { message, backup })
}
