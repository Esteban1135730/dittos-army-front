import axios from "axios";

export function extractAxiosErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return fallback;
  const data = err.response?.data;
  if (!data || typeof data !== "object") return fallback;
  const message = "message" in data ? data.message : undefined;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (parts.length > 0) return parts.join(" ");
  }
  return fallback;
}
