import { describe, expect, it } from "vitest";
import { accountPhone, phoneCountry, PHONE_COUNTRIES } from "@/lib/phone-country";

describe("Account phone countries", () => {
  it("includes countries beyond mobile-money coverage", () => {
    expect(PHONE_COUNTRIES.some((c) => c.code === "US" && c.dial === "1")).toBe(true);
    expect(PHONE_COUNTRIES.some((c) => c.code === "UG" && c.name === "Uganda")).toBe(true);
  });
  it("normalizes a selected Kenyan local number", () => {
    expect(accountPhone("0712 345 678", "KE")).toBe("+254712345678");
  });
  it("rejects international numbers from a different selected country", () => {
    expect(accountPhone("+256770123456", "KE")).toBeNull();
  });
  it("prefers the saved country and infers legacy international numbers", () => {
    expect(phoneCountry("KE", "256770123456")?.code).toBe("KE");
    expect(phoneCountry(null, "256770123456")?.code).toBe("UG");
    expect(phoneCountry(null, "0770123456")).toBeNull();
  });
});