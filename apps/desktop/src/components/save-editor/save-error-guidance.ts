export type SaveErrorCategory = "hmac" | "permission" | "missing" | "general";

export function classifySaveError(error: string): SaveErrorCategory {
  const message = error.toLowerCase();
  if (message.includes("hmac verification failed")) return "hmac";
  if (message.includes("permission denied") || message.includes("access is denied"))
    return "permission";
  if (message.includes("not found") || message.includes("no such file")) return "missing";
  return "general";
}
