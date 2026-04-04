export function getAiSummaryMarkdown(aiSummary: string | null): string {
  if (!aiSummary) return "";

  const cleaned = aiSummary
    .trim()
    .replace(/^```(?:json\s*)?/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "string") return parsed.trim();
    if (
      parsed &&
      typeof parsed === "object" &&
      "summary" in parsed &&
      typeof parsed.summary === "string"
    ) {
      return parsed.summary.trim();
    }
  } catch {
    // Invalid/non-JSON summary format: fall back to cleaned text.
  }

  return cleaned;
}
