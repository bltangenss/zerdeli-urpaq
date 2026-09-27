import "server-only";
import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweepExpiredBuckets(now);
  const safeKey = createHash("sha256").update(key).digest("hex");
  const current = buckets.get(safeKey);
  if (!current || current.resetAt <= now) {
    if (!current) ensureBucketCapacity();
    buckets.set(safeKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function requestIp(headers: Headers): string {
  return (
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function sweepExpiredBuckets(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  lastSweepAt = now;
}

function ensureBucketCapacity() {
  if (buckets.size < MAX_BUCKETS) return;
  const oldestKey = buckets.keys().next().value as string | undefined;
  if (oldestKey !== undefined) buckets.delete(oldestKey);
}
