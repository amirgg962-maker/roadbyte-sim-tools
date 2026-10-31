use std::path::PathBuf;

use crate::core::detection::{game_by_id, GameType};
use crate::core::profile::{Profile, ProfileDetector, SaveFile};

use super::{helpers::read_profile_sii, ProfileInfo, SaveInfo};

impl TryFrom<Profile> for ProfileInfo {
    type Error = String;

    fn try_from(p: Profile) -> Result<Self, Self::Error> {
        let display_name = p.display_name();
        let (active_mods, cached_experience, cached_distance) = read_profile_sii(&p.path)?;
        Ok(Self {
            path: p.path.to_string_lossy().to_string(),
            name: p.name,
            game_id: p.game_type.id().to_string(),
            display_name,
            active_mods,
            cached_experience,
            cached_distance,
        })
    }
}

impl From<SaveFile> for SaveInfo {
    fn from(s: SaveFile) -> Self {
        Self {
            profile_path: s.profile_path.to_string_lossy().to_string(),
            save_name: s.save_name,
            path: s.path.to_string_lossy().to_string(),
            game_sii_path: s.game_sii_path.to_string_lossy().to_string(),
        }
    }
}

#[tauri::command]
pub fn list_profiles(
    game_id: Option<String>,
    custom_path: Option<String>,
) -> Result<Vec<ProfileInfo>, String> {
    let game_id = game_id.as_deref().unwrap_or("ets2");
    let game = game_by_id(game_id).ok_or_else(|| format!("Unsupported game id: {game_id}"))?;
    let mut detector = ProfileDetector::for_game(game);
    if let Some(path_str) = custom_path {
        let trimmed = path_str.trim();
        if !trimmed.is_empty() {
            detector.custom_paths.push(PathBuf::from(trimmed));
        }
    }
    let profiles = detector.get_profiles()?;
    profiles.into_iter().map(ProfileInfo::try_from).collect()
}

#[tauri::command]
pub fn get_saves(profile_path: String) -> Result<Vec<SaveInfo>, String> {
    let profile = Profile {
        path: PathBuf::from(&profile_path),
        name: String::new(),
        game_type: GameType::Ets2,
    };
    let detector = ProfileDetector::new();
    let saves = detector.get_saves(&profile)?;
    Ok(saves.into_iter().map(SaveInfo::from).collect())
}

#[tauri::command]
pub fn delete_profile(
    profile_path: String,
    state: tauri::State<'_, super::read_only::ReadOnlyState>,
) -> Result<super::EditResult, String> {
    state.ensure_writable()?;
    let path = std::path::Path::new(&profile_path);
    let backup = crate::core::profile_ops::delete_profile(path).map_err(|e| e.to_string())?;
    Ok(super::EditResult {
        message: format!(
            "Profile deleted. Full backup created at {}",
            backup.display()
        ),
        backup: Some(backup.to_string_lossy().to_string()),
    })
}
