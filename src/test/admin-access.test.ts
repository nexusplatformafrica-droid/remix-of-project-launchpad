import { describe, expect, it } from "vitest";
import { assignedAdminRole } from "@/lib/admin-access";

describe("assigned dashboard admins", () => {
  it("allows explicitly assigned main and team admins", () => {
    expect(assignedAdminRole("admin")).toBe(true);
    expect(assignedAdminRole("staff")).toBe(true);
  });
  it("denies ordinary users and missing roles", () => {
    expect(assignedAdminRole("user")).toBe(false);
    expect(assignedAdminRole(undefined)).toBe(false);
    expect(assignedAdminRole("moderator")).toBe(false);
  });
});