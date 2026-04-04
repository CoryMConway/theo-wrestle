import { describe, expect, it } from "vitest";
import { getAiSummaryMarkdown } from "../lib/ai-summary";

describe("getAiSummaryMarkdown", () => {
  it("returns empty string for null", () => {
    expect(getAiSummaryMarkdown(null)).toBe("");
  });

  it("extracts and trims summary from JSON object", () => {
    expect(
      getAiSummaryMarkdown(
        JSON.stringify({ summary: "  ## Topics Wrestled With\n- A  ", tags: ["x"] })
      )
    ).toBe("## Topics Wrestled With\n- A");
  });

  it("returns trimmed parsed JSON string", () => {
    expect(getAiSummaryMarkdown(JSON.stringify("  plain markdown  "))).toBe(
      "plain markdown"
    );
  });

  it("strips json code fences from non-JSON text fallback", () => {
    expect(
      getAiSummaryMarkdown("```json\n## Topics Wrestled With\n- A\n```")
    ).toBe("## Topics Wrestled With\n- A");
  });

  it("falls back to cleaned text for invalid JSON", () => {
    expect(getAiSummaryMarkdown("```json\n{invalid json}\n```")).toBe(
      "{invalid json}"
    );
  });
});
