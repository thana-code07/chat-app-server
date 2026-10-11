import assert from "node:assert/strict";
import test from "node:test";
import { allowHit, resetLimits, windowSize } from "../middleware/rateLimit.js";

test("rejected attempts keep the window trimmed", () => {
  resetLimits();
  assert.equal(allowHit("auth", "ip:1", 1000, 2, 0), true);
  assert.equal(allowHit("auth", "ip:1", 1000, 2, 10), true);
  assert.equal(allowHit("auth", "ip:1", 1000, 2, 20), false);
  assert.equal(allowHit("auth", "ip:1", 1000, 2, 30), false);
  assert.equal(windowSize("auth", "ip:1"), 2);
});

test("an expired window accepts a new attempt", () => {
  resetLimits();
  assert.equal(allowHit("send", "user-1", 1000, 1, 0), true);
  assert.equal(allowHit("send", "user-1", 1000, 1, 10), false);
  assert.equal(allowHit("send", "user-1", 1000, 1, 1500), true);
});
