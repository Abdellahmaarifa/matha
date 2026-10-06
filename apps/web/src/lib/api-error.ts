interface ApiErrorShape {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as ApiErrorShape).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

export function apiFieldErrors(error: unknown): Record<string, string> {
  if (error && typeof error === "object" && "fields" in error) {
    const fields = (error as ApiErrorShape).fields;
    if (fields && typeof fields === "object") return fields;
  }
  return {};
}
