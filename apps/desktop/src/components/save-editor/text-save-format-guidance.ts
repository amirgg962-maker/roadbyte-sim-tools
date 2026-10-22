export function getTextSaveReadOnlyMessage(readOnly: boolean): string | null {
  return readOnly
    ? "Read Only is enabled. Turn it off in Settings before changing the config."
    : null;
}
