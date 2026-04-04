import { describe, expect, it } from "vitest";
import {
  OFFICIAL_HOST_ORIGIN,
  isOfficialHostedInstance,
} from "../lib/hosting";

describe("isOfficialHostedInstance", () => {
  it("returns true for the official hosted URL", () => {
    expect(
      isOfficialHostedInstance(`${OFFICIAL_HOST_ORIGIN}/some/path?x=1`)
    ).toBe(true);
  });

  it("returns false for non-official URLs", () => {
    expect(isOfficialHostedInstance("https://example.com")).toBe(false);
  });

  it("returns false for invalid URL strings", () => {
    expect(isOfficialHostedInstance("not-a-url")).toBe(false);
  });
});
