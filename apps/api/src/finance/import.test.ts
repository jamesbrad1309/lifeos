import { describe, expect, it } from "vitest";
import { foldPayee, importHash } from "#finance/import.service";

describe("foldPayee", () => {
  it("ignores case, accents, punctuation and spacing", () => {
    expect(foldPayee("TESCO  Stores*3245")).toBe("tesco stores 3245");
    expect(foldPayee("Cà Phê Đen")).toBe("ca phe den");
    expect(foldPayee(null)).toBe("");
    expect(foldPayee("SAINSBURY'S, LONDON")).toBe("sainsburys london");
  });
});

describe("importHash", () => {
  it("is stable for the same row and payee spelled differently", () => {
    expect(importHash("a", "2026-09-01", -350, "Pret A Manger", 0)).toBe(
      importHash("a", "2026-09-01", -350, "PRET a  manger", 0),
    );
  });
  it("tells identical rows apart by occurrence, and accounts apart", () => {
    expect(importHash("a", "2026-09-01", -350, "Pret", 0)).not.toBe(
      importHash("a", "2026-09-01", -350, "Pret", 1),
    );
    expect(importHash("a", "2026-09-01", -350, "Pret", 0)).not.toBe(
      importHash("b", "2026-09-01", -350, "Pret", 0),
    );
  });
});
