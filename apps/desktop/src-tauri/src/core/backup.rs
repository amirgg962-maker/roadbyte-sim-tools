use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use crate::core::error::CoreError;

pub fn backup_file(source: &Path) -> Result<PathBuf, CoreError> {
    let timestamp = Local::now().format("%d-%m-%Y_%H-%M-%S").to_string();
    backup_file_at(source, &timestamp)
}

fn backup_file_at(source: &Path, timestamp: &str) -> Result<PathBuf, CoreError> {
    if let Some(save_dir) = save_directory_for_file(source) {
        return backup_save_dir_at(save_dir, timestamp);
    }

    let source_dir = source
        .parent()
        .ok_or_else(|| CoreError::NotFound(format!("Parent of {:?}", source)))?;

    let filename = source
        .file_name()
        .ok_or_else(|| CoreError::NotFound(format!("Filename from {:?}", source)))?;

    let backup_root = source_dir.join("backup");
    fs::create_dir_all(&backup_root)?;

    let mut backup_dir = backup_root.join(timestamp);
    let mut suffix = 1_u32;
    loop {
        match fs::create_dir(&backup_dir) {
            Ok(()) => break,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                backup_dir = backup_root.join(format!("{timestamp}_{suffix}"));
                suffix = suffix.checked_add(1).ok_or_else(|| {
                    CoreError::Validation("Could not allocate a unique backup directory".into())
                })?;
            }
            Err(error) => return Err(error.into()),
        }
    }

    let backup_path = backup_dir.join(filename);
    if let Err(error) = fs::copy(source, &backup_path) {
        let _ = fs::remove_dir_all(&backup_dir);
        return Err(error.into());
    }

    Ok(backup_path)
}

fn save_directory_for_file(source: &Path) -> Option<&Path> {
    if source.file_name()?.to_str()? != "game.sii" {
        return None;
    }
    let save_dir = source.parent()?;
    let save_root = save_dir.parent()?;
    let profile_dir = save_root.parent()?;
    if save_root
        .file_name()?
        .to_str()?
        .eq_ignore_ascii_case("save")
        && profile_dir.join("profile.sii").is_file()
    {
        Some(save_dir)
    } else {
        None
    }
}

fn backup_save_dir_at(save_dir: &Path, timestamp: &str) -> Result<PathBuf, CoreError> {
    let profile_dir = save_dir
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| CoreError::NotFound(format!("Profile parent of {:?}", save_dir)))?;
    let save_name = save_dir
        .file_name()
        .ok_or_else(|| CoreError::NotFound(format!("Save name from {:?}", save_dir)))?;
    let backup_root = profile_dir.join("roadbyte-backups");
    fs::create_dir_all(&backup_root)?;

    let mut timestamp_dir = backup_root.join(timestamp);
    let mut suffix = 1_u32;
    loop {
        match fs::create_dir(&timestamp_dir) {
            Ok(()) => break,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                timestamp_dir = backup_root.join(format!("{timestamp}_{suffix}"));
                suffix = suffix.checked_add(1).ok_or_else(|| {
                    CoreError::Validation("Could not allocate a unique backup directory".into())
                })?;
            }
            Err(error) => return Err(error.into()),
        }
    }

    let backup_path = timestamp_dir.join(save_name);
    if let Err(error) = copy_dir_all(save_dir, &backup_path) {
        let _ = fs::remove_dir_all(&timestamp_dir);
        return Err(error);
    }
    Ok(backup_path)
}

fn copy_dir_all(source: &Path, target: &Path) -> Result<(), CoreError> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let entry_type = entry.file_type()?;
        let target_path = target.join(entry.file_name());
        if entry_type.is_symlink() {
            return Err(CoreError::Validation(
                "Save backups cannot contain symlinks".into(),
            ));
        }
        if entry_type.is_dir() {
            copy_dir_all(&entry.path(), &target_path)?;
        } else if entry_type.is_file() {
            fs::copy(entry.path(), target_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_backup_file_creates_backup() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("game.sii");
        fs::write(&src, "some save data").unwrap();

        let backup_path = backup_file(&src).unwrap();
        assert!(backup_path.exists());

        let content = fs::read_to_string(&backup_path).unwrap();
        assert_eq!(content, "some save data");
    }

    #[test]
    fn test_backup_file_returns_different_path() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("game.sii");
        fs::write(&src, "data").unwrap();

        let backup_path = backup_file(&src).unwrap();
        assert_ne!(backup_path, src);
        assert!(backup_path.to_string_lossy().contains("backup"));
    }

    #[test]
    fn test_backup_file_source_not_exists() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("nonexistent.sii");
        let result = backup_file(&src);
        assert!(result.is_err());
    }

    #[test]
    fn test_backup_file_nested_backup_dir() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("game.sii");
        fs::write(&src, "data").unwrap();

        let backup_path = backup_file(&src).unwrap();
        // Should be at <dir>/backup/<timestamp>/game.sii
        assert_eq!(backup_path.file_name().unwrap(), "game.sii");
        let parent = backup_path.parent().unwrap();
        assert!(parent.to_string_lossy().contains("backup"));
    }

    #[test]
    fn test_backup_file_same_timestamp_never_overwrites_previous_backup() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("game.sii");
        fs::write(&source, "first save").unwrap();

        let first_backup = backup_file_at(&source, "fixed_timestamp").unwrap();
        fs::write(&source, "second save").unwrap();
        let second_backup = backup_file_at(&source, "fixed_timestamp").unwrap();

        assert_ne!(first_backup, second_backup);
        assert_eq!(fs::read_to_string(first_backup).unwrap(), "first save");
        assert_eq!(fs::read_to_string(second_backup).unwrap(), "second save");
    }

    #[test]
    fn test_save_backup_is_a_full_snapshot_visible_to_backup_center() {
        let directory = tempfile::tempdir().unwrap();
        let profile = directory.path().join("profiles").join("profile");
        let save_dir = profile.join("save").join("autosave");
        fs::create_dir_all(&save_dir).unwrap();
        fs::write(profile.join("profile.sii"), "profile").unwrap();
        fs::write(save_dir.join("game.sii"), "game before edit").unwrap();
        fs::write(save_dir.join("info.sii"), "save metadata").unwrap();

        let backup = backup_file_at(&save_dir.join("game.sii"), "fixed_timestamp").unwrap();
        let entries =
            crate::core::backups::list_backups(&[profile.to_string_lossy().to_string()], None)
                .unwrap();

        assert!(backup.starts_with(profile.join("roadbyte-backups")));
        assert_eq!(
            fs::read_to_string(backup.join("game.sii")).unwrap(),
            "game before edit"
        );
        assert_eq!(
            fs::read_to_string(backup.join("info.sii")).unwrap(),
            "save metadata"
        );
        let canonical_backup = fs::canonicalize(&backup).unwrap();
        let listed_backup = entries.iter().find(|entry| {
            Path::new(&entry.path)
                .canonicalize()
                .is_ok_and(|path| path == canonical_backup)
        });
        assert!(listed_backup.is_some());
        assert_eq!(listed_backup.unwrap().backup_type, "save");
    }
}
