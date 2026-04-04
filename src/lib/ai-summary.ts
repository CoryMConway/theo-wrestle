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
    // JSON.parse failed — check if it looks like a JSON wrapper and strip it
    const summaryMatch = cleaned.match(
      /["']summary["']\s*:\s*["']([\s\S]*?)["']\s*,\s*["']tags["']/
    );
    if (summaryMatch) {
      return summaryMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .trim();
    }

    // Strip leading { "summary": " and trailing ", "tags": [...] }
    const stripped = cleaned
      .replace(/^\s*\{\s*["']summary["']\s*:\s*["']/i, "")
      .replace(/["']\s*,\s*["']tags["']\s*:\s*\[.*\]\s*\}\s*$/i, "")
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .trim();

    if (stripped !== cleaned) {
      return stripped;
    }
  }

  return cleaned;
}
