import { describe, expect, it } from "vitest";
import { whopTitle } from "@/lib/whop.server";

describe("whopTitle", () => {
  it("keeps developer plan names within Whop's 30-character limit", () => {
    expect(whopTitle("Developer API plan (monthly)")).toBe("MOVIE MAX Developer API");
  });
  it("never exceeds 30 characters for long names", () => {
    expect(whopTitle("SVIP Member Quarterly Super Long Name Here").length).toBeLessThanOrEqual(30);
  });
});
