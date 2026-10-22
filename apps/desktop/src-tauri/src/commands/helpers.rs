use std::path::Path;

use crate::core::compatibility::{
    check_compatibility, find_game_version_in_config, CompatibilityStatus,
};
use crate::core::detection::find_config_files;
use crate::save_parser::compression::{decompress_save, read_save_file};
use crate::save_parser::sii::{SiiDocument, MAX_ARRAY_ITEMS};

pub fn calc_level(exp: i64) -> u32 {
    let exp = exp as f64;
    ((1.0 + (1.0 + 8.0 * exp / 100.0).sqrt()) / 2.0).floor() as u32
}

pub fn save_file_from_game_sii(
    game_sii_path: &str,
) -> Result<crate::core::profile::SaveFile, String> {
    let path = Path::new(game_sii_path);
    let save_name = path
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .ok_or_else(|| "Invalid save path: missing save directory".to_string())?;
    let profile_path = path
        .ancestors()
        .nth(3)
        .ok_or_else(|| "Invalid save path: missing profile directory".to_string())?
        .to_path_buf();
    Ok(crate::core::profile::SaveFile::new(profile_path, save_name))
}

pub fn read_profile_sii(
    profile_path: &Path,
) -> Result<(Vec<String>, Option<i64>, Option<f64>), String> {
    let sii_path = profile_path.join("profile.sii");
    let data = read_save_file(&sii_path).map_err(|error| error.to_string())?;
    let content = decompress_save(&data).map_err(|error| error.to_string())?;
    let doc = SiiDocument::new(content);

    let mut mods: Vec<String> = vec![];
    if let Some(count_str) = doc.get_property("active_mods") {
        if let Some(count) = count_str
            .parse::<usize>()
            .ok()
            .filter(|count| *count <= MAX_ARRAY_ITEMS)
        {
            for i in 0..count {
                let key = format!("active_mods[{}]", i);
                if let Some(val) = doc.get_property(&key) {
                    let clean = val.trim_matches('"').to_string();
                    mods.push(clean);
                }
            }
        }
    }

    let cached_xp = doc
        .get_property("cached_experience")
        .and_then(|s| s.parse::<i64>().ok());

    let cached_dist = doc
        .get_property("cached_distance")
        .and_then(|s| s.parse::<f64>().ok());

    Ok((mods, cached_xp, cached_dist))
}

pub fn read_info_sii(save_path: &Path) -> Result<(Option<u32>, Option<i64>, Vec<String>), String> {
    let info_path = save_path.join("info.sii");
    let data = read_save_file(&info_path).map_err(|error| error.to_string())?;
    let content = decompress_save(&data).map_err(|error| error.to_string())?;
    let doc = SiiDocument::new(content);

    let version = doc
        .get_property("version")
        .and_then(|s| s.parse::<u32>().ok());

    let file_time = doc
        .get_property("file_time")
        .and_then(|s| s.parse::<i64>().ok());

    let mut deps: Vec<String> = vec![];
    if let Some(count_str) = doc.get_property("dependencies") {
        if let Some(count) = count_str
            .parse::<usize>()
            .ok()
            .filter(|count| *count <= MAX_ARRAY_ITEMS)
        {
            for i in 0..count {
                let key = format!("dependencies[{}]", i);
                if let Some(val) = doc.get_property(&key) {
                    let clean = val.trim_matches('"').to_string();
                    deps.push(clean);
                }
            }
        }
    }

    Ok((version, file_time, deps))
}

/// Read game version from config.cfg, returning (version_string, warning).
pub fn read_game_version(custom_path: Option<&Path>) -> (Option<String>, Option<String>) {
    let configs = find_config_files(custom_path);
    for path in &configs {
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if let Some(version) = find_game_version_in_config(&content) {
            let warning = match check_compatibility(&version) {
                CompatibilityStatus::Supported => None,
                CompatibilityStatus::Untested { detected_version } => {
                    Some(format!(
                        "Game version {} is newer than tested ({}). Should work, but proceed with caution.",
                        detected_version,
                        crate::core::compatibility::TESTED_GAME_VERSION.to_display(),
                    ))
                }
                CompatibilityStatus::Deprecated { detected_version, min_version } => {
                    Some(format!(
                        "Game version {} is older than minimum supported ({}). Some features may not work.",
                        detected_version, min_version,
                    ))
                }
                CompatibilityStatus::Unknown => {
                    Some("Could not determine game version from config.cfg.".into())
                }
            };
            return (Some(version), warning);
        }
    }
    (None, None)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn profile_sii_read_errors_are_not_reported_as_empty_mods() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(directory.path().join("profile.sii"), [0xff, 0xfe]).unwrap();
        assert!(read_profile_sii(directory.path()).is_err());
    }

    #[test]
    fn info_sii_read_errors_are_not_reported_as_empty_metadata() {
        let directory = tempfile::tempdir().unwrap();
        std::fs::write(directory.path().join("info.sii"), [0xff, 0xfe]).unwrap();
        assert!(read_info_sii(directory.path()).is_err());
    }

    #[test]
    fn test_level_zero() {
        assert_eq!(calc_level(0), 1);
    }

    #[test]
    fn test_level_one() {
        assert_eq!(calc_level(100), 2);
    }

    #[test]
    fn test_level_two() {
        assert_eq!(calc_level(300), 3);
    }

    #[test]
    fn test_level_ten() {
        // 10 -> xp = 100 * (10*9/2) = 100 * 45 = 4500
        assert_eq!(calc_level(4500), 10);
    }

    #[test]
    fn test_level_boundary_just_below() {
        // level 2 needs 100 xp, so 99 -> level 1
        assert_eq!(calc_level(99), 1);
    }

    #[test]
    fn test_level_boundary_exact() {
        // level 2 needs 100 xp
        assert_eq!(calc_level(100), 2);
    }

    #[test]
    fn test_level_large() {
        // level 100 -> xp = 100 * (100*99/2) = 100 * 4950 = 495000
        assert_eq!(calc_level(495000), 100);
    }

    #[test]
    fn test_negative_xp() {
        // NaN from sqrt(negative) floors to 0
        assert_eq!(calc_level(-100), 0);
    }
}
