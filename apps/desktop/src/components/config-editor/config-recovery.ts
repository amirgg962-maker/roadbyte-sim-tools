export type ConfigRecoveryMessage = "missing" | "discovery-error" | "load-error";

export interface ConfigRecoveryState {
  message: ConfigRecoveryMessage;
  retry: "scan" | "load";
  openSettings: true;
}

export function getConfigRecoveryState({
  configCount,
  selectedPath,
  loadError,
  discoveryError,
}: {
  configCount: number;
  selectedPath?: string | null;
  loadError: string | null;
  discoveryError: string | null;
}): ConfigRecoveryState {
  if (discoveryError) {
    return { message: "discovery-error", retry: "scan", openSettings: true };
  }
  if (loadError || selectedPath || configCount > 0) {
    return { message: "load-error", retry: "load", openSettings: true };
  }
  return { message: "missing", retry: "scan", openSettings: true };
}
