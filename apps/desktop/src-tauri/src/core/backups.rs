use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use chrono::Local;
use serde::Serialize;

use crate::core::detection::{all_games, get_current_platform};
use crate::save_parser::compression::decompress_save;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub path: String,
    pub name: String,
    pub display_name: String,
    pub backup_type: String,
    pub created_at: String,
    pub original_path: String,
    pub profile_name: String,
    pub size_bytes: u64,
    pub file_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupActionResult {
    pub message: String,
    pub path: String,
    pub safety_backup: Option<String>,
}

#[derive(Debug, Clone)]
struct BackupContext {
    profile_paths: Vec<PathBuf>,
    profiles_dirs: Vec<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BackupKind {
    Save,
    Profile,
}

#[derive(Debug, Clone)]
struct ResolvedBackup {
    backup_path: PathBuf,
    target_path: PathBuf,
    kind: BackupKind,
    root: PathBuf,
    name: String,
}

fn normalize(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn push_unique(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    let candidate = normalize(&candidate);
    if !paths
        .iter()
        .any(|existing| normalize(existing) == candidate)
    {
        paths.push(candidate);
    }
}

fn add_profiles_dir(context: &mut BackupContext, path: PathBuf) {
    if path.is_dir() {
        push_unique(&mut context.profiles_dirs, path);
    }
}

fn discover_context(profile_paths: &[String], custom_path: Option<&str>) -> BackupContext {
    let mut context = BackupContext {
        profile_paths: Vec::new(),
        profiles_dirs: Vec::new(),
    };

    for profile_path in profile_paths {
        let trimmed = profile_path.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = PathBuf::from(trimmed);
        if let Some(parent) = path.parent() {
            if parent.file_name().and_then(|name| name.to_str()) == Some("profiles") {
                add_profiles_dir(&mut context, parent.to_path_buf());
            }
        }
        push_unique(&mut context.profile_paths, path);
    }

    for game in all_games() {
        for game_path in game.get_paths(get_current_platform()) {
            add_profiles_dir(&mut context, game_path.join("profiles"));
        }
    }

    if let Some(custom_path) = custom_path.map(str::trim).filter(|path| !path.is_empty()) {
        let custom_path = PathBuf::from(custom_path);
        if custom_path.file_name().and_then(|name| name.to_str()) == Some("profiles") {
            add_profiles_dir(&mut context, custom_path.clone());
        } else if custom_path.join("profiles").is_dir() {
            add_profiles_dir(&mut context, custom_path.join("profiles"));
        } else if custom_path.join("profile.sii").is_file() {
            if let Some(parent) = custom_path.parent() {
                add_profiles_dir(&mut context, parent.to_path_buf());
            }
            push_unique(&mut context.profile_paths, custom_path);
        }
    }

    // Enumerate existing profiles beneath all discovered profile roots. This also lets
    // the Backup Center see save backups from profiles not currently selected in the UI.
    for profiles_dir in &context.profiles_dirs {
        if let Ok(entries) = fs::read_dir(profiles_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && path.join("profile.sii").is_file() {
                    push_unique(&mut context.profile_paths, path);
                }
            }
        }
    }

    context
}

pub fn list_backups(
    profile_paths: &[String],
    custom_path: Option<&str>,
) -> Result<Vec<BackupEntry>, String> {
    let context = discover_context(profile_paths, custom_path);
    let mut entries = Vec::new();
    let mut seen = HashSet::new();

    for profile_path in &context.profile_paths {
        let root = profile_path.join("roadbyte-backups");
        collect_backups_from_root(
            &root,
            BackupKind::Save,
            profile_path,
            &mut entries,
            &mut seen,
        )?;
    }

    for profiles_dir in &context.profiles_dirs {
        let root = profiles_dir.join("roadbyte-backups");
        collect_backups_from_root(
            &root,
            BackupKind::Profile,
            profiles_dir,
            &mut entries,
            &mut seen,
        )?;
    }

    entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(entries)
}

fn collect_backups_from_root(
    root: &Path,
    kind: BackupKind,
    owner_path: &Path,
    output: &mut Vec<BackupEntry>,
    seen: &mut HashSet<PathBuf>,
) -> Result<(), String> {
    let root_metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Could not inspect backup directory {}: {error}",
                root.display()
            ))
        }
    };
    if root_metadata.file_type().is_symlink() || !root_metadata.is_dir() {
        return Err(format!(
            "Backup root {} must be a real directory.",
            root.display()
        ));
    }
    let root = normalize(root);
    let timestamp_dirs = fs::read_dir(&root).map_err(|error| {
        format!(
            "Could not read backup directory {}: {error}",
            root.display()
        )
    })?;

    for timestamp_entry in timestamp_dirs.flatten() {
        let timestamp_path = timestamp_entry.path();
        if !timestamp_entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            continue;
        }
        let created_at = timestamp_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        let backup_dirs = match fs::read_dir(&timestamp_path) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for backup_entry in backup_dirs.flatten() {
            if !backup_entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                continue;
            }
            let path = normalize(&backup_entry.path());
            if !seen.insert(path.clone()) {
                continue;
            }
            let name = path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default();
            let marker_exists = match kind {
                BackupKind::Save => path.join("game.sii").is_file(),
                BackupKind::Profile => path.join("profile.sii").is_file(),
            };
            if !marker_exists {
                continue;
            }
            let (size_bytes, file_count) = directory_stats(&path)?;
            let target_path = match kind {
                BackupKind::Save => owner_path.join("save").join(&name),
                BackupKind::Profile => owner_path.join(&name),
            };
            let profile_name = match kind {
                BackupKind::Save => owner_path
                    .file_name()
                    .map(|value| decode_profile_folder_name(&value.to_string_lossy()))
                    .unwrap_or_default(),
                BackupKind::Profile => decode_profile_folder_name(&name),
            };
            let display_name = if kind == BackupKind::Profile {
                decode_profile_folder_name(&name)
            } else {
                name.clone()
            };

            output.push(BackupEntry {
                path: path.to_string_lossy().to_string(),
                name,
                display_name,
                backup_type: match kind {
                    BackupKind::Save => "save".to_string(),
                    BackupKind::Profile => "profile".to_string(),
                },
                created_at: created_at.clone(),
                original_path: target_path.to_string_lossy().to_string(),
                profile_name,
                size_bytes,
                file_count,
            });
        }
    }
    Ok(())
}

fn directory_stats(path: &Path) -> Result<(u64, u64), String> {
    let mut total_bytes = 0_u64;
    let mut file_count = 0_u64;
    let entries = fs::read_dir(path)
        .map_err(|error| format!("Could not inspect backup {}: {error}", path.display()))?;
    for entry in entries.flatten() {
        let metadata = match entry.file_type() {
            Ok(file_type) if file_type.is_symlink() => continue,
            Ok(_) => match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            },
            Err(_) => continue,
        };
        if metadata.is_dir() {
            let (bytes, count) = directory_stats(&entry.path())?;
            total_bytes = total_bytes.saturating_add(bytes);
            file_count = file_count.saturating_add(count);
        } else if metadata.is_file() {
            total_bytes = total_bytes.saturating_add(metadata.len());
            file_count = file_count.saturating_add(1);
        }
    }
    Ok((total_bytes, file_count))
}

fn resolve_backup(
    backup_path: &str,
    profile_paths: &[String],
    custom_path: Option<&str>,
) -> Result<ResolvedBackup, String> {
    let requested = PathBuf::from(backup_path.trim());
    if requested.as_os_str().is_empty() {
        return Err("No backup folder was supplied.".to_string());
    }
    let requested_type = fs::symlink_metadata(&requested)
        .map_err(|error| format!("Backup path cannot be accessed: {error}"))?
        .file_type();
    if requested_type.is_symlink() || !requested_type.is_dir() {
        return Err("The selected backup must be a real directory.".to_string());
    }
    let backup = fs::canonicalize(&requested)
        .map_err(|error| format!("Could not resolve backup path: {error}"))?;
    let context = discover_context(profile_paths, custom_path);

    for profile_path in &context.profile_paths {
        let root = profile_path.join("roadbyte-backups");
        if let Some(root) = canonical_directory(&root) {
            if is_direct_backup_child(&backup, &root)
                && backup.join("game.sii").is_file()
                && !backup.join("profile.sii").exists()
            {
                let name = direct_child_name(&backup)?;
                return Ok(ResolvedBackup {
                    backup_path: backup,
                    target_path: profile_path.join("save").join(&name),
                    kind: BackupKind::Save,
                    root,
                    name,
                });
            }
        }
    }

    for profiles_dir in &context.profiles_dirs {
        let root = profiles_dir.join("roadbyte-backups");
        if let Some(root) = canonical_directory(&root) {
            if is_direct_backup_child(&backup, &root) && backup.join("profile.sii").is_file() {
                let name = direct_child_name(&backup)?;
                return Ok(ResolvedBackup {
                    backup_path: backup,
                    target_path: profiles_dir.join(&name),
                    kind: BackupKind::Profile,
                    root,
                    name,
                });
            }
        }
    }

    Err("This folder is not a recognized Roadbyte save or profile backup. Refresh the Backup Center and try again.".to_string())
}

fn canonical_directory(path: &Path) -> Option<PathBuf> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return None;
    }
    fs::canonicalize(path).ok()
}

fn is_direct_backup_child(backup: &Path, root: &Path) -> bool {
    backup.parent().and_then(Path::parent) == Some(root)
}

fn direct_child_name(path: &Path) -> Result<String, String> {
    let name = path
        .file_name()
        .ok_or_else(|| "Backup folder has no name.".to_string())?;
    let name_path = Path::new(name);
    if name_path.components().count() != 1
        || !matches!(name_path.components().next(), Some(Component::Normal(_)))
    {
        return Err("Backup folder name is invalid.".to_string());
    }
    Ok(name.to_string_lossy().to_string())
}

pub fn restore_backup(
    backup_path: &str,
    profile_paths: &[String],
    custom_path: Option<&str>,
    read_only: bool,
) -> Result<BackupActionResult, String> {
    if read_only {
        return Err(
            "Read Only protection is enabled. Turn it off before restoring a backup.".to_string(),
        );
    }
    let resolved = resolve_backup(backup_path, profile_paths, custom_path)?;
    // Validate before creating directories or touching the current restore target.
    // This catches missing/truncated primary SII files and unsafe filesystem entries.
    validate_backup_for_restore(&resolved.backup_path, resolved.kind)?;
    let target = resolved.target_path.clone();
    let target_parent = target
        .parent()
        .ok_or_else(|| "Restore destination has no parent directory.".to_string())?;
    fs::create_dir_all(target_parent).map_err(|error| {
        format!(
            "Could not prepare restore destination {}: {error}",
            target_parent.display()
        )
    })?;

    let stamp = Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
    let staging = target_parent.join(format!(
        ".{}.roadbyte-restore-staging-{stamp}",
        resolved.name
    ));
    let rollback = target_parent.join(format!(
        ".{}.roadbyte-restore-rollback-{stamp}",
        resolved.name
    ));
    if staging.exists() || rollback.exists() {
        return Err(
            "A temporary restore folder already exists. Refresh and try again.".to_string(),
        );
    }

    if let Err(error) = copy_dir_all(&resolved.backup_path, &staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    if let Err(error) = validate_backup_for_restore(&staging, resolved.kind) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!(
            "The staged backup failed validation; the current save/profile was not replaced. {error}"
        ));
    }

    let mut safety_backup = None;
    let mut moved_old = false;
    if target.exists() {
        let target_type = match fs::symlink_metadata(&target) {
            Ok(metadata) => metadata.file_type(),
            Err(error) => {
                let _ = fs::remove_dir_all(&staging);
                return Err(format!("Could not inspect current restore target: {error}"));
            }
        };
        if target_type.is_symlink() || !target_type.is_dir() {
            let _ = fs::remove_dir_all(&staging);
            return Err(
                "Restore target is not a regular directory; refusing to replace it.".to_string(),
            );
        }
        let backup = match create_backup_copy(&target) {
            Ok(path) => path,
            Err(error) => {
                let _ = fs::remove_dir_all(&staging);
                return Err(error);
            }
        };
        safety_backup = Some(backup.to_string_lossy().to_string());
        if let Err(error) = fs::rename(&target, &rollback) {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!(
                "A safety backup was created at {}, but the current target could not be moved aside: {error}",
                safety_backup.as_deref().unwrap_or_default()
            ));
        }
        moved_old = true;
    }

    if let Err(restore_error) = fs::rename(&staging, &target) {
        if moved_old {
            if let Err(rollback_error) = fs::rename(&rollback, &target) {
                let _ = fs::remove_dir_all(&staging);
                return Err(format!(
                    "Restore failed ({restore_error}) and rollback failed ({rollback_error}). The previous data remains at {}.",
                    rollback.display()
                ));
            }
        }
        let _ = fs::remove_dir_all(&staging);
        return Err(format!(
            "Could not install restored backup: {restore_error}"
        ));
    }

    let mut message = format!(
        "Restored {} backup '{}' to {}.",
        kind_label(resolved.kind),
        resolved.name,
        target.display()
    );
    if let Some(path) = &safety_backup {
        message.push_str(&format!(" The previous version was backed up to {path}."));
    }
    if moved_old {
        if let Err(error) = fs::remove_dir_all(&rollback) {
            message.push_str(&format!(
                " A temporary rollback folder remains at {} ({error}).",
                rollback.display()
            ));
        }
    }

    Ok(BackupActionResult {
        message,
        path: target.to_string_lossy().to_string(),
        safety_backup,
    })
}

pub fn delete_backup(
    backup_path: &str,
    profile_paths: &[String],
    custom_path: Option<&str>,
    read_only: bool,
) -> Result<BackupActionResult, String> {
    if read_only {
        return Err(
            "Read Only protection is enabled. Turn it off before deleting a backup.".to_string(),
        );
    }
    let resolved = resolve_backup(backup_path, profile_paths, custom_path)?;
    fs::remove_dir_all(&resolved.backup_path).map_err(|error| {
        format!(
            "Could not delete backup {}: {error}",
            resolved.backup_path.display()
        )
    })?;

    // Remove only the now-empty timestamp container; never remove the backup root.
    if let Some(timestamp_dir) = resolved.backup_path.parent() {
        if fs::read_dir(timestamp_dir).is_ok_and(|mut entries| entries.next().is_none()) {
            let _ = fs::remove_dir(timestamp_dir);
        }
    }

    Ok(BackupActionResult {
        message: format!(
            "Deleted the {} backup '{}' from {}.",
            kind_label(resolved.kind),
            resolved.name,
            resolved.root.display()
        ),
        path: resolved.backup_path.to_string_lossy().to_string(),
        safety_backup: None,
    })
}

fn decode_profile_folder_name(name: &str) -> String {
    hex::decode(name)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .filter(|decoded| !decoded.is_empty())
        .unwrap_or_else(|| name.to_string())
}

fn kind_label(kind: BackupKind) -> &'static str {
    match kind {
        BackupKind::Save => "save",
        BackupKind::Profile => "profile",
    }
}

fn backup_root_for_target(source: &Path) -> Result<PathBuf, String> {
    let parent = source
        .parent()
        .ok_or_else(|| format!("Could not resolve parent of {}", source.display()))?;
    let parent_name = parent
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    let owner = if parent_name.eq_ignore_ascii_case("save") {
        parent
            .parent()
            .ok_or_else(|| "Could not resolve profile folder.".to_string())?
    } else {
        parent
    };
    Ok(owner.join("roadbyte-backups"))
}

fn create_backup_copy(source: &Path) -> Result<PathBuf, String> {
    if !source.is_dir() {
        return Err(format!(
            "Cannot back up missing directory {}",
            source.display()
        ));
    }
    let root = backup_root_for_target(source)?;
    ensure_real_backup_root(&root)?;
    let name = direct_child_name(source)?;
    let base_stamp = Local::now().format("%Y%m%d_%H%M%S_%3f").to_string();
    let mut index = 0_u32;
    let target = loop {
        let stamp = if index == 0 {
            base_stamp.clone()
        } else {
            format!("{base_stamp}_{index}")
        };
        let candidate = root.join(stamp).join(&name);
        if !candidate.exists() {
            break candidate;
        }
        index = index.saturating_add(1);
    };
    let parent = target
        .parent()
        .ok_or_else(|| "Could not resolve safety-backup destination.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create safety-backup directory: {error}"))?;
    if let Err(error) = copy_dir_all(source, &target) {
        let _ = fs::remove_dir_all(&target);
        return Err(format!("Safety backup failed: {error}"));
    }
    Ok(target)
}

fn ensure_real_backup_root(root: &Path) -> Result<(), String> {
    match fs::symlink_metadata(root) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(format!(
                "Backup root {} must be a real directory.",
                root.display()
            ));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(root).map_err(|error| {
                format!("Could not create backup root {}: {error}", root.display())
            })?;
        }
        Err(error) => {
            return Err(format!(
                "Could not inspect backup root {}: {error}",
                root.display()
            ))
        }
    }
    let metadata = fs::symlink_metadata(root)
        .map_err(|error| format!("Could not inspect backup root {}: {error}", root.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!(
            "Backup root {} must be a real directory.",
            root.display()
        ));
    }
    Ok(())
}

fn copy_dir_all(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("Could not create {}: {error}", destination.display()))?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("Could not read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("Could not read directory entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect {}: {error}", entry.path().display()))?;
        let target = destination.join(entry.file_name());
        if file_type.is_symlink() {
            return Err(format!(
                "Restore stopped because {} is a symbolic link.",
                entry.path().display()
            ));
        }
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &target)
                .map_err(|error| format!("Could not copy {}: {error}", entry.path().display()))?;
        } else {
            return Err(format!(
                "Restore stopped because {} is not a regular file or directory.",
                entry.path().display()
            ));
        }
    }
    Ok(())
}

/// Validates the backup's directory tree and its primary SII marker before restore.
/// ETS2's binary `BSII` payload is accepted as opaque data; this tool restores it byte-for-byte
/// but intentionally does not attempt to parse it. `ScsC` containers must be decompressible,
/// except when the decoded payload is a validly unpacked but unsupported `BSII` save.
fn validate_backup_for_restore(path: &Path, kind: BackupKind) -> Result<(), String> {
    let root_metadata = fs::symlink_metadata(path).map_err(|error| {
        format!(
            "Could not inspect backup directory {}: {error}",
            path.display()
        )
    })?;
    if root_metadata.file_type().is_symlink() || !root_metadata.is_dir() {
        return Err("The selected backup is not a regular directory.".to_string());
    }
    validate_safe_tree(path)?;

    let marker_name = match kind {
        BackupKind::Save => "game.sii",
        BackupKind::Profile => "profile.sii",
    };
    validate_sii_marker(&path.join(marker_name), marker_name)
}

fn validate_safe_tree(path: &Path) -> Result<(), String> {
    let entries = fs::read_dir(path).map_err(|error| {
        format!(
            "Could not inspect backup contents in {}: {error}",
            path.display()
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "Could not read an entry in backup {}: {error}",
                path.display()
            )
        })?;
        let entry_path = entry.path();
        let file_type = entry.file_type().map_err(|error| {
            format!(
                "Could not inspect backup entry {}: {error}",
                entry_path.display()
            )
        })?;
        if file_type.is_symlink() {
            return Err(format!(
                "Backup validation failed because {} is a symbolic link. No data was restored.",
                entry_path.display()
            ));
        }
        if file_type.is_dir() {
            validate_safe_tree(&entry_path)?;
        } else if !file_type.is_file() {
            return Err(format!(
                "Backup validation failed because {} is not a regular file or directory.",
                entry_path.display()
            ));
        }
    }
    Ok(())
}

fn validate_sii_marker(path: &Path, marker_name: &str) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        format!("Backup is incomplete: required file {marker_name} is unavailable ({error}).")
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!(
            "Backup is invalid: {marker_name} must be a regular file."
        ));
    }
    if metadata.len() < 4 {
        return Err(format!(
            "Backup is incomplete: {marker_name} is empty or truncated. Restore was cancelled."
        ));
    }

    let bytes = fs::read(path)
        .map_err(|error| format!("Could not read backup marker {marker_name}: {error}"))?;

    // ETS2's binary save format is not parsed by Roadbyte, but it can be restored as an
    // opaque file. Require more than the four-byte signature to reject an empty/truncated file.
    if bytes.starts_with(b"BSII") {
        if bytes.len() < 8 {
            return Err(format!(
                "Backup is incomplete: binary {marker_name} is too short. Restore was cancelled."
            ));
        }
        return Ok(());
    }

    let decoded = match decompress_save(&bytes) {
        Ok(text) => text,
        Err(error)
            if bytes.starts_with(b"ScsC")
                && error
                    .to_string()
                    .contains("Binary format BSII not supported") =>
        {
            // The ScsC container was successfully decrypted/decompressed, but its inner
            // payload is the unsupported binary save format. Keeping it opaque is safe.
            return Ok(());
        }
        Err(error) => {
            return Err(format!(
                "Backup integrity check failed for {marker_name}: {error}. The destination was not changed."
            ));
        }
    };
    let decoded = decoded.trim_start_matches('\u{feff}').trim_start();
    let opening_brace = decoded.find('{');
    let closing_brace = decoded.rfind('}');
    let has_complete_structure = matches!((opening_brace, closing_brace), (Some(open), Some(close)) if close > open)
        && decoded.trim_end().ends_with('}');
    if !decoded.starts_with("SiiNunit") || !has_complete_structure {
        return Err(format!(
            "Backup integrity check failed: {marker_name} does not contain a complete SiiNunit structure. The destination was not changed."
        ));
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use std::fs;

    #[cfg(unix)]
    fn create_directory_symlink(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(windows)]
    fn create_directory_symlink(target: &Path, link: &Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_dir(target, link)
    }

    #[test]
    fn test_backup_center_rejects_symlinked_backup_root() {
        let directory = tempfile::tempdir().unwrap();
        let actual_root = directory.path().join("actual-backups");
        let profile = directory.path().join("profile");
        fs::create_dir_all(&actual_root).unwrap();
        fs::create_dir_all(&profile).unwrap();
        let symlink_root = profile.join("roadbyte-backups");
        if create_directory_symlink(&actual_root, &symlink_root).is_err() {
            return;
        }

        let result = collect_backups_from_root(
            &symlink_root,
            BackupKind::Save,
            &profile,
            &mut Vec::new(),
            &mut HashSet::new(),
        );
        assert!(result.is_err());
        assert_eq!(canonical_directory(&symlink_root), None);
    }

    fn make_save(profile: &Path, save_name: &str, data: &str) -> PathBuf {
        let save = profile.join("save").join(save_name);
        fs::create_dir_all(&save).unwrap();
        fs::write(save.join("game.sii"), data).unwrap();
        fs::write(save.join("info.sii"), "name: test").unwrap();
        save
    }

    fn make_backup(root: &Path, timestamp: &str, name: &str, marker: &str, data: &str) -> PathBuf {
        let backup = root.join(timestamp).join(name);
        fs::create_dir_all(&backup).unwrap();
        fs::write(backup.join(marker), data).unwrap();
        backup
    }

    #[test]
    fn lists_save_backups_and_reports_size() {
        let temp = tempfile::tempdir().unwrap();
        let profile = temp.path().join("profiles").join("p1");
        fs::create_dir_all(profile.join("save")).unwrap();
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120000_000",
            "autosave",
            "game.sii",
            "backup-data",
        );
        let entries = list_backups(
            &[profile.to_string_lossy().to_string()],
            Some(temp.path().to_str().unwrap()),
        )
        .unwrap();

        // list_backups intentionally includes backups from other discovered ETS2 profiles too.
        // Do not assume this machine has no other backups: locate the entry created by this test.
        let expected_backup = normalize(&backup);
        let entry = entries
            .iter()
            .find(|entry| normalize(Path::new(&entry.path)) == expected_backup)
            .expect("the backup created by this test should be listed");

        assert_eq!(entry.backup_type, "save");
        assert_eq!(entry.name, "autosave");
        assert_eq!(entry.size_bytes, "backup-data".len() as u64);
        assert_eq!(normalize(Path::new(&entry.path)), expected_backup);
    }

    #[test]
    fn restore_save_backs_up_existing_target_first() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profiles_dir = game_root.join("profiles");
        let profile = profiles_dir.join("p1");
        let old_sii = "SiiNunit\n{\n old_save: true\n}\n";
        let restored_sii = "SiiNunit\n{\n restored_save: true\n}\n";
        let target = make_save(&profile, "autosave", old_sii);
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120000_000",
            "autosave",
            "game.sii",
            restored_sii,
        );
        let profile_paths = vec![profile.to_string_lossy().to_string()];
        let result = restore_backup(
            backup.to_str().unwrap(),
            &profile_paths,
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(target.join("game.sii")).unwrap(),
            restored_sii
        );
        assert!(
            backup.exists(),
            "the selected source backup must be retained"
        );
        assert!(result.safety_backup.is_some());
        let safety_backup = PathBuf::from(result.safety_backup.as_ref().unwrap());
        assert_eq!(
            fs::read_to_string(safety_backup.join("game.sii")).unwrap(),
            old_sii
        );
        assert!(
            list_backups(&profile_paths, Some(game_root.to_str().unwrap()))
                .unwrap()
                .len()
                >= 2
        );
    }

    #[test]
    fn restores_deleted_profile_from_global_backup() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profiles_dir = game_root.join("profiles");
        fs::create_dir_all(&profiles_dir).unwrap();
        let profile_sii = "SiiNunit\n{\n profile_name: \"p1\"\n}\n";
        let backup = make_backup(
            &profiles_dir.join("roadbyte-backups"),
            "20261022_120000_000",
            "p1",
            "profile.sii",
            profile_sii,
        );
        let result = restore_backup(
            backup.to_str().unwrap(),
            &[],
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(profiles_dir.join("p1").join("profile.sii")).unwrap(),
            profile_sii
        );
        assert_eq!(result.safety_backup, None);
    }

    #[test]
    fn delete_backup_removes_only_selected_backup() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        fs::create_dir_all(profile.join("save")).unwrap();
        let first = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120000_000",
            "autosave",
            "game.sii",
            "first",
        );
        let second = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120001_000",
            "quicksave",
            "game.sii",
            "second",
        );
        let paths = vec![profile.to_string_lossy().to_string()];
        delete_backup(
            first.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap();
        assert!(!first.exists());
        assert!(second.exists());
    }

    #[test]
    fn restore_refuses_truncated_scsc_backup_without_changing_destination() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        let original = "SiiNunit\n{\n original_save: true\n}\n";
        let target = make_save(&profile, "autosave", original);
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120100_000",
            "autosave",
            "game.sii",
            "placeholder",
        );
        fs::write(backup.join("game.sii"), b"ScsCshort").unwrap();
        let paths = vec![profile.to_string_lossy().to_string()];

        let error = restore_backup(
            backup.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap_err();

        assert!(error.contains("integrity check failed"));
        assert_eq!(
            fs::read_to_string(target.join("game.sii")).unwrap(),
            original
        );
        let save_root = profile.join("save");
        let leftovers: Vec<_> = fs::read_dir(&save_root)
            .unwrap()
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .contains("roadbyte-restore-staging")
            })
            .collect();
        assert!(
            leftovers.is_empty(),
            "failed validation should clean staging folders"
        );
    }

    #[test]
    fn restore_refuses_incomplete_plain_sii_without_changing_destination() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        let original = "SiiNunit\n{\n original_save: true\n}\n";
        let target = make_save(&profile, "autosave", original);
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120150_000",
            "autosave",
            "game.sii",
            "SiiNunit\n{\n broken_save: true\n",
        );
        let paths = vec![profile.to_string_lossy().to_string()];

        let error = restore_backup(
            backup.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap_err();

        assert!(error.contains("complete SiiNunit structure"));
        assert_eq!(
            fs::read_to_string(target.join("game.sii")).unwrap(),
            original
        );
        assert!(backup.exists());
    }

    #[test]
    fn restore_accepts_opaque_binary_bsii_backup() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        fs::create_dir_all(profile.join("save")).unwrap();
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120200_000",
            "autosave",
            "game.sii",
            "placeholder",
        );
        let binary_data = b"BSII\x01\x00\x10\x00binary-payload";
        fs::write(backup.join("game.sii"), binary_data).unwrap();
        let paths = vec![profile.to_string_lossy().to_string()];

        restore_backup(
            backup.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap();

        assert_eq!(
            fs::read(profile.join("save").join("autosave").join("game.sii")).unwrap(),
            binary_data.to_vec()
        );
    }

    #[test]
    fn restore_accepts_valid_scsc_compressed_sii_backup() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        fs::create_dir_all(profile.join("save")).unwrap();
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120250_000",
            "autosave",
            "game.sii",
            "placeholder",
        );
        let sii = "SiiNunit\n{\n money_account: 1200\n}\n";
        let compressed = crate::save_parser::compression::compress_save(sii).unwrap();
        fs::write(backup.join("game.sii"), &compressed).unwrap();
        let paths = vec![profile.to_string_lossy().to_string()];

        restore_backup(
            backup.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            false,
        )
        .unwrap();

        assert_eq!(
            fs::read(profile.join("save").join("autosave").join("game.sii")).unwrap(),
            compressed
        );
        assert!(backup.exists());
    }

    #[test]
    fn restore_is_blocked_in_read_only_mode() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        fs::create_dir_all(profile.join("save")).unwrap();
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120300_000",
            "autosave",
            "game.sii",
            "SiiNunit\n{\n}\n",
        );
        let paths = vec![profile.to_string_lossy().to_string()];

        let error = restore_backup(
            backup.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            true,
        )
        .unwrap_err();
        assert!(error.contains("Read Only"));
        assert!(!profile.join("save").join("autosave").exists());
        assert!(backup.exists());
    }

    #[test]
    fn delete_backup_is_blocked_in_read_only_mode() {
        let temp = tempfile::tempdir().unwrap();
        let game_root = temp.path().join("game");
        let profile = game_root.join("profiles").join("p1");
        fs::create_dir_all(profile.join("save")).unwrap();
        let backup = make_backup(
            &profile.join("roadbyte-backups"),
            "20261022_120400_000",
            "autosave",
            "game.sii",
            "SiiNunit\n{\n}\n",
        );
        let paths = vec![profile.to_string_lossy().to_string()];

        let error = delete_backup(
            backup.to_str().unwrap(),
            &paths,
            Some(game_root.to_str().unwrap()),
            true,
        )
        .unwrap_err();
        assert!(error.contains("Read Only"));
        assert!(backup.exists());
    }
}
