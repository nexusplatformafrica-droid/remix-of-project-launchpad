import { describe, expect, it } from "vitest";
import { customerMessage, mapDepositStatus } from "@/lib/pawapay.server";

describe("pawaPay deposits", () => {
  it("treats COMPLETED as paid", () => {
    expect(mapDepositStatus({ status: "FOUND", data: { status: "COMPLETED" } }).status).toBe("success");
  });
  it("treats FAILED as failed", () => {
    expect(mapDepositStatus({ status: "FOUND", data: { status: "FAILED" } }).status).toBe("failed");
  });
  it("keeps waiting while processing", () => {
    expect(mapDepositStatus({ status: "FOUND", data: { status: "PROCESSING" } }).status).toBe("pending");
  });
  it("limits the phone prompt text to 22 characters", () => {
    expect(customerMessage("MOVIE MAX Premium Monthly plan!").length).toBeLessThanOrEqual(22);
  });
});
