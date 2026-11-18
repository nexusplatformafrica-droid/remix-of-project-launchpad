import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdb", () => ({ fdb: {} }));
vi.mock("../lib/fdb", () => ({ fdb: {} }));

import { primeSetting } from "@/lib/app-settings";
import { PAYMENT_KEEPALIVE_MS, paymentBackend } from "@/lib/relworx";

describe("payment backend", () => {
  it("uses the Nexus backend by default", () => {
    expect(paymentBackend()).toBe("https://payment.nexusplatformafrica.workers.dev");
  });

  it("ignores an old Railway backend saved in settings", () => {
    primeSetting("payment", { backend_url: "https://function-bun-production-ab6c.up.railway.app" });
    expect(paymentBackend()).toBe("https://payment.nexusplatformafrica.workers.dev");
  });

  it("replaces payment.bonto.run even when saved in settings", () => {
    primeSetting("payment", { backend_url: "https://payment.bonto.run/" });
    expect(paymentBackend()).toBe("https://payment.nexusplatformafrica.workers.dev");
  });

  it("pings the backend every 3 seconds", () => {
    expect(PAYMENT_KEEPALIVE_MS).toBe(3000);
  });
});

describe("retired Totalum backend", () => {
  it("is replaced even when saved in settings", () => {
    primeSetting("payment", { backend_url: "https://relworx-payments.totalum-project.com" });
    expect(paymentBackend()).toBe("https://payment.nexusplatformafrica.workers.dev");
  });
});
