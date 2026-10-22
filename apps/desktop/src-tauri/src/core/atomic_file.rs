use std::fs;
use std::io::{self, Write};
use std::path::Path;

pub fn write_atomic(path: &Path, contents: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    temporary.write_all(contents)?;

    if let Ok(metadata) = fs::metadata(path) {
        temporary
            .as_file()
            .set_permissions(metadata.permissions())?;
    }
    temporary.as_file().sync_all()?;
    temporary
        .persist(path)
        .map(|_| ())
        .map_err(|error| error.error)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn replaces_existing_file_with_complete_contents() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("save.sii");
        fs::write(&path, b"old contents").unwrap();

        write_atomic(&path, b"new complete contents").unwrap();

        assert_eq!(fs::read(path).unwrap(), b"new complete contents");
    }
}
