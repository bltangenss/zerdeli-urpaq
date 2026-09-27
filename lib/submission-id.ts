import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createSubmissionId(random = randomBytes(6)): string {
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    suffix += ALPHABET[random[index] % ALPHABET.length];
  }
  return `ZU-2026-${suffix}`;
}

export function createSubmissionIdFromKey(idempotencyKey: string, secret: string, attempt = 0): string {
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new RangeError("Submission ID attempt must be a non-negative safe integer");
  }

  // Keep attempt zero compatible with already-issued IDs. Further attempts form a
  // deterministic sequence so a real six-character collision can be skipped and
  // retried consistently without trusting a client-supplied submission ID.
  const input = attempt === 0 ? idempotencyKey : `${idempotencyKey}\0${attempt}`;
  const digest = createHmac("sha256", secret).update(input).digest();
  return createSubmissionId(digest);
}
