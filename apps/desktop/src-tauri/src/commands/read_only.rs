use std::sync::atomic::{AtomicBool, Ordering};

use tauri::State;

pub struct ReadOnlyState(AtomicBool);

impl Default for ReadOnlyState {
    fn default() -> Self {
        Self(AtomicBool::new(true))
    }
}

impl ReadOnlyState {
    pub fn set(&self, read_only: bool) {
        self.0.store(read_only, Ordering::SeqCst);
    }

    pub fn is_read_only(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }

    pub fn ensure_writable(&self) -> Result<(), String> {
        if self.is_read_only() {
            Err("Read Only protection is enabled. Turn it off before changing files.".into())
        } else {
            Ok(())
        }
    }
}

#[tauri::command]
pub fn set_read_only(read_only: bool, state: State<'_, ReadOnlyState>) {
    state.set(read_only);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_defaults_to_read_only_and_can_be_toggled() {
        let state = ReadOnlyState::default();

        assert!(state.ensure_writable().is_err());
        state.set(false);
        assert!(state.ensure_writable().is_ok());
        state.set(true);
        assert!(state.ensure_writable().is_err());
    }
}
