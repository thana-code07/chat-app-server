import assert from "node:assert/strict";
import test from "node:test";
import { readUserQuery } from "../validation/directory.js";

test("user search accepts a short query and ignores blank space", () => {
  assert.deepEqual(readUserQuery({ q: "  Ada " }), { q: "ada" });
  assert.deepEqual(readUserQuery({}), { q: "" });
  assert.equal(readUserQuery({ q: "a".repeat(33) }).error, "q must be at most 32 characters");
  assert.equal(readUserQuery({ q: 12 }).error, "q must be a string");
});
