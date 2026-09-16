import assert from "assert";
import { describe, it } from "node:test";
import {
  bookingStatusForMissedJob,
  canCompleteJob,
  canMarkJobMissed,
  parseMissedPickupInput,
} from "./job-outcome";

describe("successful completion guards", () => {
  it("allows completing an in-progress job", () => {
    assert.deepStrictEqual(canCompleteJob("in_progress"), { ok: true });
  });

  it("does not allow completing a missed job", () => {
    const result = canCompleteJob("missed");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /missed/i);
    }
  });
});

describe("unable to collect / missed pickup", () => {
  it("stores Bin not available as a missed reason", () => {
    const parsed = parseMissedPickupInput({ reason: "BIN_NOT_AVAILABLE" });
    assert.deepStrictEqual(parsed, {
      ok: true,
      reason: "BIN_NOT_AVAILABLE",
      note: null,
      photoUrl: null,
    });
    assert.deepStrictEqual(canMarkJobMissed("in_progress"), { ok: true });
    assert.equal(bookingStatusForMissedJob(), "missed");
  });

  it("requires and keeps a note when the reason is Other", () => {
    const missing = parseMissedPickupInput({ reason: "OTHER" });
    assert.equal(missing.ok, false);

    const parsed = parseMissedPickupInput({
      reason: "OTHER",
      note: "  Gate locked after hours  ",
    });
    assert.deepStrictEqual(parsed, {
      ok: true,
      reason: "OTHER",
      note: "Gate locked after hours",
      photoUrl: null,
    });
  });

  it("accepts an optional photo URL", () => {
    const parsed = parseMissedPickupInput({
      reason: "EXCESS_WASTE",
      photoUrl: "https://example.com/missed.jpg",
    });
    assert.deepStrictEqual(parsed, {
      ok: true,
      reason: "EXCESS_WASTE",
      note: null,
      photoUrl: "https://example.com/missed.jpg",
    });
  });

  it("keeps booking status aligned with a missed job", () => {
    assert.equal(bookingStatusForMissedJob(), "missed");
    assert.notEqual(bookingStatusForMissedJob(), "completed");
  });
});
