// The database explains refusals in plain words (see the migrations). Show
// those as they are; replace anything technical with a calm general message.
const OWN_WORDS = new Set(["28000", "22023", "23505", "23514"]);

export function friendlyError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "";
  const message = error.message ?? "";
  if (error.code && OWN_WORDS.has(error.code)) return message;
  if (error.code === "42501" && !message.startsWith("permission denied") && !message.includes("row-level security")) {
    return message;
  }
  if (error.code === "42501") return "You do not have permission to do that. Ask an owner of this Care Circle.";
  return "That did not save. Check your connection and try again.";
}

/** Only allow redirects to paths inside this app. */
export function safeNext(value: unknown, fallback = "/"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : fallback;
}
