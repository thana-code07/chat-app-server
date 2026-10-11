import assert from "node:assert/strict";
import test from "node:test";
import { readConversationCursor, readPage, readUserQuery } from "../validation/directory.js";

test("user search accepts a short query and ignores blank space", () => {
  assert.deepEqual(readUserQuery({ q: "  Ada " }), { q: "ada" });
  assert.deepEqual(readUserQuery({}), { q: "" });
  assert.equal(readUserQuery({ q: "a".repeat(33) }).error, "q must be at most 32 characters");
  assert.equal(readUserQuery({ q: 12 }).error, "q must be a string");
});

test("conversation pages stay inside a bounded window", () => {
  assert.equal(readPage({ page: 101 }).error, "page must be an integer from 1 to 100");
  assert.deepEqual(readPage({}), { page: 1, pageSize: 20 });
});

test("conversation cursor keeps the time and partner together", () => {
  const partnerId = "64b000000000000000000002";
  assert.deepEqual(readConversationCursor(`2026-07-15T03:08:00.000Z|${partnerId}`), {
    before: { at: new Date("2026-07-15T03:08:00.000Z"), partnerId },
  });
  assert.equal(readConversationCursor("not-a-cursor").error, "before must be a conversation cursor");
});
