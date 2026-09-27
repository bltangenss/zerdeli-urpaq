import { describe, expect, it } from "vitest";
import { createSubmissionId, createSubmissionIdFromKey } from "@/lib/submission-id";

describe("submission id", () => {
  it("creates the required format", () => {
    expect(createSubmissionId(Buffer.from([1, 2, 3, 4, 5, 6]))).toMatch(/^ZU-2026-[A-Z2-9]{6}$/);
  });
  it("is deterministic for an idempotency key", () => {
    expect(createSubmissionIdFromKey("same-request-key", "x".repeat(32))).toBe(
      createSubmissionIdFromKey("same-request-key", "x".repeat(32))
    );
  });

  it("creates a deterministic fallback sequence after a collision", () => {
    const secret = "x".repeat(32);
    const first = createSubmissionIdFromKey("same-request-key", secret, 0);
    const second = createSubmissionIdFromKey("same-request-key", secret, 1);
    expect(second).toMatch(/^ZU-2026-[A-Z2-9]{6}$/);
    expect(second).not.toBe(first);
    expect(createSubmissionIdFromKey("same-request-key", secret, 1)).toBe(second);
  });

  it("rejects an invalid collision attempt", () => {
    expect(() => createSubmissionIdFromKey("same-request-key", "x".repeat(32), -1)).toThrow(RangeError);
  });
});
