export function getSaveLoadStartState<T>(_previousData: T | null) {
  return {
    saveData: null as T | null,
    loadError: null,
    isLoading: true,
  };
}
