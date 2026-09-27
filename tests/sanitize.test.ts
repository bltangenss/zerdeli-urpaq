import { describe, expect, it } from "vitest";
import { normalizeUserText, sanitizeSheetValue } from "@/lib/sanitize";

describe("sheet sanitization", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1", "@cmd"])("neutralizes %s", (value) => {
    expect(sanitizeSheetValue(value)).toBe(`'${value}`);
  });
  it("normalizes whitespace before checking the prefix", () => expect(sanitizeSheetValue("  =1")).toBe("'=1"));
  it("keeps ordinary names unchanged", () => expect(sanitizeSheetValue("Айгүл Ахметова")).toBe("Айгүл Ахметова"));
  it("collapses repeated spaces", () => expect(normalizeUserText("Айгүл   Ахметова")).toBe("Айгүл Ахметова"));
});
