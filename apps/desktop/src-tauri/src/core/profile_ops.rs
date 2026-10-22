use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use crate::core::error::CoreError;
use crate::save_parser::compression::{compress_save, decompress_save};

fn is_valid_save_name(name: &str) -> bool {
    !name.is_empty()
        && name.chars().count() <= 64
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
}

fn validate_save_dir(save_path: &Path) -> Result<PathBuf, CoreError> {
    if !save_path.is_dir() {
        return Err(CoreError::NotFound(format!(
            "Save directory {:?}",
            save_path
        )));
    }

    let metadata = fs::symlink_metadata(save_path)?;
    if metadata.file_type().is_symlink() {
        return Err(CoreError::Validation(
            "Save directory must not be a symlink".into(),
        ));
    }

    let save_parent = save_path
        .parent()
        .ok_or_else(|| CoreError::Validation("Save directory has no profile parent".into()))?;
    let profile_path = save_parent
        .parent()
        .ok_or_else(|| CoreError::Validation("Save directory has no profile parent".into()))?;
    if !save_parent
        .file_name()
        .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("save"))
        || !profile_path.join("profile.sii").is_file()
        || !save_path.join("game.sii").is_file()
    {
        return Err(CoreError::Validation(
            "Save must be a game.sii directory under a profile containing profile.sii".into(),
        ));
    }
    if fs::symlink_metadata(save_parent)?.file_type().is_symlink()
        || fs::symlink_metadata(profile_path)?.file_type().is_symlink()
        || fs::symlink_metadata(save_path.join("game.sii"))?
            .file_type()
            .is_symlink()
        || fs::symlink_metadata(profile_path.join("profile.sii"))?
            .file_type()
            .is_symlink()
    {
        return Err(CoreError::Validation(
            "Save and profile paths must not contain symlinks".into(),
        ));
    }

    // Resolve the path to verify its actual on-disk structure, but preserve the
    // caller's path representation for existing command results and backup paths.
    let canonical_path = save_path.canonicalize()?;
    let canonical_parent = canonical_path.parent();
    if !canonical_parent
        .and_then(Path::file_name)
        .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("save"))
    {
        return Err(CoreError::Validation(
            "Save must be located directly under a profile save directory".into(),
        ));
    }
    Ok(save_path.to_path_buf())
}

fn validate_profile_dir(profile_path: &Path) -> Result<PathBuf, CoreError> {
    if !profile_path.is_dir() {
        return Err(CoreError::NotFound(format!(
            "Profile directory {:?}",
            profile_path
        )));
    }
    if fs::symlink_metadata(profile_path)?.file_type().is_symlink()
        || !profile_path.join("profile.sii").is_file()
        || fs::symlink_metadata(profile_path.join("profile.sii"))?
            .file_type()
            .is_symlink()
    {
        return Err(CoreError::Validation(
            "Profile must be a directory containing a regular profile.sii file".into(),
        ));
    }
    profile_path.canonicalize()?;
    Ok(profile_path.to_path_buf())
}

fn update_info_sii_name(save_path: &Path, new_name: &str) -> Result<(), CoreError> {
    let info_path = save_path.join("info.sii");
    if !info_path.exists() {
        return Ok(());
    }

    // ETS2 commonly stores info.sii in the same ScsC encrypted/compressed
    // container as other SII files. Never read it as UTF-8 before detecting
    // and decoding its on-disk format.
    let original_bytes = fs::read(&info_path)?;
    let was_scsc_compressed = original_bytes.starts_with(b"ScsC");
    let content = decompress_save(&original_bytes).map_err(|error| {
        CoreError::Serialization(format!(
            "Could not decode info.sii to rename the save safely: {error}"
        ))
    })?;

    let mut lines: Vec<String> = content.lines().map(str::to_owned).collect();
    let mut changed = false;

    for line in &mut lines {
        let trimmed = line.trim();
        if trimmed.starts_with("name:") || trimmed.starts_with("name :") {
            let Some(colon_pos) = trimmed.find(':') else {
                continue;
            };
            // Preserve indentation and the field name.
            let prefix = &line[..line.find(trimmed).unwrap_or(0) + colon_pos + 1];
            *line = format!("{} \"{}\"", prefix, new_name);
            changed = true;
        }
    }

    if changed {
        let updated_content = lines.join("\n") + "\n";
        let updated_bytes = if was_scsc_compressed {
            compress_save(&updated_content).map_err(|error| {
                CoreError::Serialization(format!(
                    "Could not re-encode info.sii after changing save name: {error}"
                ))
            })?
        } else {
            updated_content.into_bytes()
        };
        crate::core::atomic_file::write_atomic(&info_path, &updated_bytes)?;
    }

    Ok(())
}

pub fn rename_save(save_path: &Path, new_name: &str) -> Result<PathBuf, CoreError> {
    if !is_valid_save_name(new_name) {
        return Err(CoreError::Validation(
            "Save name must be 1–64 characters and contain only letters, numbers, underscores, or hyphens".into(),
        ));
    }
    let save_path = validate_save_dir(save_path)?;
    let parent = save_path
        .parent()
        .ok_or_else(|| CoreError::NotFound("parent directory".into()))?;
    let new_path = parent.join(new_name);

    if new_path.exists() {
        return Err(CoreError::Validation(format!(
            "Save '{}' already exists",
            new_name
        )));
    }

    if !save_path.is_dir() {
        return Err(CoreError::NotFound(format!(
            "Save directory {:?}",
            save_path
        )));
    }

    // Read the metadata before moving the folder so the operation can be rolled back if
    // updating info.sii fails after the directory rename.
    let old_info = save_path.join("info.sii");
    let original_info = if old_info.exists() {
        Some(fs::read(&old_info)?)
    } else {
        None
    };

    fs::rename(&save_path, &new_path)?;
    if let Err(update_error) = update_info_sii_name(&new_path, new_name) {
        if let Some(contents) = original_info {
            let _ = crate::core::atomic_file::write_atomic(&new_path.join("info.sii"), &contents);
        }
        return match fs::rename(&new_path, &save_path) {
            Ok(()) => Err(update_error),
            Err(rollback_error) => Err(CoreError::Validation(format!(
                "Could not update save metadata ({update_error}); rollback also failed ({rollback_error}). The save folder is currently at {:?}.",
                new_path
            ))),
        };
    }
    Ok(new_path)
}

pub fn clone_save(save_path: &Path, new_name: &str) -> Result<PathBuf, CoreError> {
    if !is_valid_save_name(new_name) {
        return Err(CoreError::Validation(
            "Save name must be 1–64 characters and contain only letters, numbers, underscores, or hyphens".into(),
        ));
    }
    let save_path = validate_save_dir(save_path)?;
    let parent = save_path
        .parent()
        .ok_or_else(|| CoreError::NotFound("parent directory".into()))?;
    let new_path = parent.join(new_name);

    if new_path.exists() {
        return Err(CoreError::Validation(format!(
            "Save '{}' already exists",
            new_name
        )));
    }

    copy_dir_all(&save_path, &new_path)?;

    // If updating metadata fails, remove the incomplete clone rather than leaving a
    // partially-created save that could confuse the game's save list.
    if let Err(error) = update_info_sii_name(&new_path, new_name) {
        let _ = fs::remove_dir_all(&new_path);
        return Err(error);
    }

    Ok(new_path)
}

fn backup_destination(source_dir: &Path) -> Result<PathBuf, CoreError> {
    let parent = source_dir
        .parent()
        .ok_or_else(|| CoreError::NotFound(format!("Parent of {:?}", source_dir)))?;
    let parent_name = parent
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    // A regular ETS2 save is <profile>/save/<save-name>. Put backups beside the
    // profile, not under the save directory that is about to be removed.
    let backup_root_parent = if parent_name.eq_ignore_ascii_case("save") {
        parent.parent().unwrap_or(parent)
    } else {
        parent
    };
    let backup_root = backup_root_parent.join("roadbyte-backups");
    match fs::symlink_metadata(&backup_root) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(CoreError::Validation(
                "Backup root must be a real directory".into(),
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(&backup_root)?;
        }
        Err(error) => return Err(error.into()),
    }
    let metadata = fs::symlink_metadata(&backup_root)?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(CoreError::Validation(
            "Backup root must be a real directory".into(),
        ));
    }
    let item_name = source_dir
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CoreError::NotFound(format!("Directory name from {:?}", source_dir)))?;
    let timestamp = Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
    let mut candidate = backup_root.join(timestamp).join(item_name);
    let mut suffix = 1_u32;
    while candidate.exists() {
        let parent_name = candidate
            .parent()
            .and_then(|parent| parent.file_name())
            .and_then(|name| name.to_str())
            .unwrap_or("backup");
        candidate = backup_root
            .join(format!("{parent_name}_{suffix}"))
            .join(item_name);
        suffix += 1;
    }
    Ok(candidate)
}

pub fn delete_save(save_path: &Path) -> Result<PathBuf, CoreError> {
    let save_path = validate_save_dir(save_path)?;

    let backup_path = backup_destination(&save_path)?;
    if let Err(error) = copy_dir_all(&save_path, &backup_path) {
        let _ = fs::remove_dir_all(&backup_path);
        return Err(error);
    }

    // Keep the full backup outside the save folder. Only remove the selected save
    // after the copy succeeds; a deletion error leaves the backup available.
    fs::remove_dir_all(&save_path)?;
    Ok(backup_path)
}

pub fn delete_profile(profile_path: &Path) -> Result<PathBuf, CoreError> {
    let profile_path = validate_profile_dir(profile_path)?;

    let backup_path = backup_destination(&profile_path)?;
    if let Err(error) = copy_dir_all(&profile_path, &backup_path) {
        let _ = fs::remove_dir_all(&backup_path);
        return Err(error);
    }
    fs::remove_dir_all(&profile_path)?;
    Ok(backup_path)
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), CoreError> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let target = dst.join(entry.file_name());
        if ty.is_symlink() {
            return Err(CoreError::Validation(
                "Profile backups cannot contain symlinks".into(),
            ));
        } else if ty.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else if ty.is_file() {
            fs::copy(entry.path(), &target)?;
        } else {
            return Err(CoreError::Validation(
                "Profile backups can contain only regular files and directories".into(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use std::fs;

    #[cfg(unix)]
    fn create_file_symlink(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(windows)]
    fn create_file_symlink(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_file(target, link)
    }

    #[test]
    fn test_is_valid_save_name_valid() {
        assert!(is_valid_save_name("autosave"));
        assert!(is_valid_save_name("quicksave_1"));
        assert!(is_valid_save_name("my-save-123"));
        assert!(is_valid_save_name("a"));
    }

    #[test]
    fn test_is_valid_save_name_invalid() {
        assert!(!is_valid_save_name(""));
        assert!(!is_valid_save_name("save name"));
        assert!(!is_valid_save_name("save/name"));
        assert!(!is_valid_save_name("save.name"));
        assert!(!is_valid_save_name("save\nname"));
        assert!(!is_valid_save_name(&"a".repeat(65)));
    }

    #[test]
    fn test_is_valid_save_name_unicode() {
        // "salvar" is alphanumeric -> valid
        assert!(is_valid_save_name("salvar"));
    }

    #[test]
    fn test_update_info_sii_name_changes_name() {
        let dir = tempfile::tempdir().unwrap();
        let info_path = dir.path().join("info.sii");
        fs::write(
            &info_path,
            "SiiNunit\n{\n name: \"old_name\"\n version: 10\n}\n",
        )
        .unwrap();
        update_info_sii_name(dir.path(), "new_name").unwrap();
        let content = fs::read_to_string(&info_path).unwrap();
        assert!(content.contains("\"new_name\""));
        assert!(!content.contains("old_name"));
    }

    #[test]
    fn test_profile_backup_rejects_symlink_and_keeps_profile() {
        let directory = tempfile::tempdir().unwrap();
        let profile = directory.path().join("profile");
        fs::create_dir_all(&profile).unwrap();
        fs::write(profile.join("profile.sii"), "profile").unwrap();
        let outside = directory.path().join("outside.txt");
        fs::write(&outside, "outside").unwrap();
        if create_file_symlink(&outside, &profile.join("linked.txt")).is_err() {
            return;
        }

        let result = delete_profile(&profile);
        assert!(result.is_err());
        assert!(profile.join("profile.sii").exists());
        assert_eq!(fs::read_to_string(outside).unwrap(), "outside");
    }

    #[test]
    fn test_update_info_sii_name_changes_compressed_file_and_preserves_container() {
        let dir = tempfile::tempdir().unwrap();
        let info_path = dir.path().join("info.sii");
        let original = "SiiNunit\n{\n name: \"old_save\"\n version: 10\n}\n";
        let encoded = compress_save(original).unwrap();
        assert!(encoded.starts_with(b"ScsC"));
        fs::write(&info_path, encoded).unwrap();

        update_info_sii_name(dir.path(), "new_save").unwrap();

        let updated_bytes = fs::read(&info_path).unwrap();
        assert!(updated_bytes.starts_with(b"ScsC"));
        let decoded = decompress_save(&updated_bytes).unwrap();
        assert!(decoded.contains("\"new_save\""));
        assert!(!decoded.contains("old_save"));
    }

    #[test]
    fn test_rename_save_success_with_compressed_info_sii() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        let saves_dir = profile_dir.join("save");
        let old_path = saves_dir.join("old_save");
        fs::create_dir_all(&old_path).unwrap();
        fs::write(old_path.join("game.sii"), "SiiNunit\n{\n}\n").unwrap();
        let encoded = compress_save("SiiNunit\n{\n name: \"old_save\"\n}\n").unwrap();
        fs::write(old_path.join("info.sii"), encoded).unwrap();

        let new_path = rename_save(&old_path, "new_save").unwrap();
        assert!(new_path.exists());
        assert!(!old_path.exists());
        let bytes = fs::read(new_path.join("info.sii")).unwrap();
        assert!(bytes.starts_with(b"ScsC"));
        let decoded = decompress_save(&bytes).unwrap();
        assert!(decoded.contains("\"new_save\""));
    }

    #[test]
    fn test_clone_save_success_with_compressed_info_sii() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        let saves_dir = profile_dir.join("save");
        let src_path = saves_dir.join("original");
        fs::create_dir_all(&src_path).unwrap();
        fs::write(src_path.join("game.sii"), "SiiNunit\n{\n}\n").unwrap();
        let encoded = compress_save("SiiNunit\n{\n name: \"original\"\n}\n").unwrap();
        fs::write(src_path.join("info.sii"), encoded).unwrap();

        let cloned_path = clone_save(&src_path, "clone_name").unwrap();
        assert!(src_path.exists(), "the original save must remain intact");
        assert!(cloned_path.exists());
        let bytes = fs::read(cloned_path.join("info.sii")).unwrap();
        assert!(bytes.starts_with(b"ScsC"));
        let decoded = decompress_save(&bytes).unwrap();
        assert!(decoded.contains("\"clone_name\""));
        let original_bytes = fs::read(src_path.join("info.sii")).unwrap();
        let original_decoded = decompress_save(&original_bytes).unwrap();
        assert!(original_decoded.contains("\"original\""));
    }

    #[test]
    fn test_update_info_sii_name_no_name_field() {
        let dir = tempfile::tempdir().unwrap();
        let info_path = dir.path().join("info.sii");
        fs::write(&info_path, "SiiNunit\n{\n version: 10\n}\n").unwrap();
        update_info_sii_name(dir.path(), "new_name").unwrap();
        let content = fs::read_to_string(&info_path).unwrap();
        assert_eq!(content, "SiiNunit\n{\n version: 10\n}\n");
    }

    #[test]
    fn test_update_info_sii_name_file_not_found() {
        let dir = tempfile::tempdir().unwrap();
        // no info.sii created — should not error
        update_info_sii_name(dir.path(), "new_name").unwrap();
    }

    #[test]
    fn test_rename_save_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let save_dir = dir.path().join("saves").join("valid_save");
        fs::create_dir_all(&save_dir).unwrap();
        let result = rename_save(&save_dir, "invalid name");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CoreError::Validation(_)));
    }

    #[test]
    fn test_rename_save_rejects_directory_outside_profile_save_structure() {
        let dir = tempfile::tempdir().unwrap();
        let save_dir = dir.path().join("unrelated");
        fs::create_dir_all(&save_dir).unwrap();
        fs::write(save_dir.join("game.sii"), "game data").unwrap();

        let result = rename_save(&save_dir, "renamed");

        assert!(matches!(result, Err(CoreError::Validation(_))));
        assert!(save_dir.exists());
        assert!(!dir.path().join("renamed").exists());
    }

    #[test]
    fn test_clone_save_rejects_directory_outside_profile_save_structure() {
        let dir = tempfile::tempdir().unwrap();
        let save_dir = dir.path().join("unrelated");
        fs::create_dir_all(&save_dir).unwrap();
        fs::write(save_dir.join("game.sii"), "game data").unwrap();

        let result = clone_save(&save_dir, "clone");

        assert!(matches!(result, Err(CoreError::Validation(_))));
        assert!(save_dir.exists());
        assert!(!dir.path().join("clone").exists());
    }

    #[test]
    fn test_delete_save_rejects_directory_without_profile_markers() {
        let dir = tempfile::tempdir().unwrap();
        let save_dir = dir.path().join("unrelated");
        fs::create_dir_all(&save_dir).unwrap();
        fs::write(save_dir.join("important.txt"), "keep this file").unwrap();

        let result = delete_save(&save_dir);

        assert!(matches!(result, Err(CoreError::Validation(_))));
        assert_eq!(
            fs::read_to_string(save_dir.join("important.txt")).unwrap(),
            "keep this file"
        );
    }

    #[test]
    fn test_delete_profile_rejects_directory_without_profile_marker() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("unrelated");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("important.txt"), "keep this file").unwrap();

        let result = delete_profile(&profile_dir);

        assert!(matches!(result, Err(CoreError::Validation(_))));
        assert_eq!(
            fs::read_to_string(profile_dir.join("important.txt")).unwrap(),
            "keep this file"
        );
    }

    #[test]
    fn test_rename_save_success() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        let saves_dir = profile_dir.join("save");
        let old_path = saves_dir.join("old_save");
        fs::create_dir_all(&old_path).unwrap();
        fs::write(old_path.join("game.sii"), "game data").unwrap();
        let info_path = old_path.join("info.sii");
        fs::write(&info_path, "SiiNunit\n{\n name: \"old_save\"\n}\n").unwrap();

        let new_path = rename_save(&old_path, "new_save").unwrap();
        assert_eq!(new_path, saves_dir.join("new_save"));
        assert!(new_path.exists());
        assert!(!old_path.exists());

        let content = fs::read_to_string(new_path.join("info.sii")).unwrap();
        assert!(content.contains("\"new_save\""));
    }

    #[test]
    fn test_rename_save_already_exists() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        let saves_dir = profile_dir.join("save");
        let old_path = saves_dir.join("save_a");
        let existing_path = saves_dir.join("save_b");
        fs::create_dir_all(&old_path).unwrap();
        fs::write(old_path.join("game.sii"), "game data").unwrap();
        fs::create_dir_all(&existing_path).unwrap();

        let result = rename_save(&old_path, "save_b");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CoreError::Validation(_)));
    }

    #[test]
    fn test_clone_save_success() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        let saves_dir = profile_dir.join("save");
        let src_path = saves_dir.join("original");
        fs::create_dir_all(&src_path).unwrap();
        fs::write(src_path.join("game.sii"), "content").unwrap();
        let info_path = src_path.join("info.sii");
        fs::write(&info_path, "SiiNunit\n{\n name: \"original\"\n}\n").unwrap();

        let cloned_path = clone_save(&src_path, "clone_name").unwrap();
        assert_eq!(cloned_path, saves_dir.join("clone_name"));
        assert!(cloned_path.exists());
        assert!(cloned_path.join("game.sii").exists());
        let content = fs::read_to_string(cloned_path.join("info.sii")).unwrap();
        assert!(content.contains("\"clone_name\""));
    }

    #[test]
    fn test_clone_save_invalid_name() {
        let dir = tempfile::tempdir().unwrap();
        let result = clone_save(&dir.path().join("src"), "invalid/name");
        assert!(result.is_err());
    }

    #[test]
    fn test_clone_save_already_exists() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        let saves_dir = profile_dir.join("save");
        let src = saves_dir.join("src");
        let dst = saves_dir.join("dst");
        fs::create_dir_all(&src).unwrap();
        fs::write(src.join("game.sii"), "game data").unwrap();
        fs::create_dir_all(&dst).unwrap();
        let result = clone_save(&src, "dst");
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_save_creates_complete_backup_outside_deleted_save() {
        let dir = tempfile::tempdir().unwrap();
        let profile_dir = dir.path().join("profile");
        let save_dir = profile_dir.join("save").join("quicksave");
        fs::create_dir_all(&save_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();
        fs::write(save_dir.join("game.sii"), "game data").unwrap();
        fs::write(save_dir.join("info.sii"), "info data").unwrap();
        fs::write(save_dir.join("manifest.sii"), "manifest data").unwrap();

        let backup_path = delete_save(&save_dir).unwrap();
        assert!(!save_dir.exists());
        assert!(backup_path.exists());
        assert!(!backup_path.starts_with(&save_dir));
        assert_eq!(
            fs::read_to_string(backup_path.join("game.sii")).unwrap(),
            "game data"
        );
        assert_eq!(
            fs::read_to_string(backup_path.join("info.sii")).unwrap(),
            "info data"
        );
        assert_eq!(
            fs::read_to_string(backup_path.join("manifest.sii")).unwrap(),
            "manifest data"
        );
        assert!(backup_path.starts_with(profile_dir.join("roadbyte-backups")));
    }

    #[test]
    fn test_delete_profile_creates_complete_backup_outside_deleted_profile() {
        let dir = tempfile::tempdir().unwrap();
        let profiles_dir = dir.path().join("profiles");
        let profile_dir = profiles_dir.join("profile");
        fs::create_dir_all(&profile_dir).unwrap();
        fs::write(profile_dir.join("profile.sii"), "profile data").unwrap();

        let save_dir = profile_dir.join("save").join("autosave");
        fs::create_dir_all(&save_dir).unwrap();
        fs::write(save_dir.join("game.sii"), "game data").unwrap();

        let backup_path = delete_profile(&profile_dir).unwrap();
        assert!(!profile_dir.exists());
        assert!(backup_path.exists());
        assert!(!backup_path.starts_with(&profile_dir));
        assert_eq!(
            fs::read_to_string(backup_path.join("profile.sii")).unwrap(),
            "profile data"
        );
        assert_eq!(
            fs::read_to_string(backup_path.join("save").join("autosave").join("game.sii")).unwrap(),
            "game data"
        );
        assert!(backup_path.starts_with(profiles_dir.join("roadbyte-backups")));
    }
}
