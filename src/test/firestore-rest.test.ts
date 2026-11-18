import { describe, expect, it } from "vitest";
import { fromFirestoreFields } from "@/lib/firestore-rest";

describe("firestore REST values", () => {
  it("turns typed Firestore fields into plain values", () => {
    expect(
      fromFirestoreFields({
        title: { stringValue: "Kampala Nights" },
        year: { integerValue: "2025" },
        published: { booleanValue: true },
        tags: { arrayValue: { values: [{ stringValue: "VJ Junior" }] } },
        poster: { nullValue: null },
      }),
    ).toEqual({ title: "Kampala Nights", year: 2025, published: true, tags: ["VJ Junior"], poster: null });
  });
});
