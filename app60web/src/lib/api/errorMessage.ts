/** Monta mensagem legível a partir do corpo JSON de erro da API (string ou Zod flatten). */
export function messageFromApiErrorBody(data: unknown, httpStatus: number): string {
  if (!data || typeof data !== "object" || data === null) {
    return `HTTP ${httpStatus}`;
  }

  const record = data as Record<string, unknown>;
  const err = record["error"];

  if (typeof err === "string" && err.trim()) {
    return err.trim();
  }

  if (err && typeof err === "object" && !Array.isArray(err)) {
    const flat = err as { formErrors?: unknown; fieldErrors?: unknown };
    const parts: string[] = [];

    if (Array.isArray(flat.formErrors)) {
      for (const x of flat.formErrors) {
        if (typeof x === "string" && x.trim()) parts.push(x.trim());
      }
    }

    const fe = flat.fieldErrors;
    if (fe && typeof fe === "object" && !Array.isArray(fe)) {
      for (const [key, val] of Object.entries(fe as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          const msgs = val.filter((x): x is string => typeof x === "string" && x.trim() !== "");
          if (msgs.length) parts.push(`${key}: ${msgs.join(", ")}`);
        }
      }
    }

    if (parts.length) return parts.join(" · ");
  }

  if (typeof record["message"] === "string" && record["message"].trim()) {
    return record["message"].trim();
  }

  return `HTTP ${httpStatus}`;
}
