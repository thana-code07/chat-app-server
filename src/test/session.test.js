import assert from "node:assert/strict";
import test from "node:test";
import { earlierStatuses } from "../services/messageService.js";
import { blockedInMemory, rememberRevocation, resetRevocationState } from "../services/revocationService.js";
import { readAccessToken, signAccessToken } from "../services/tokenService.js";
import { readSocketToken } from "../socket/auth.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-ok";
}

test("socket auth does not read the token from the query string", () => {
  const token = readSocketToken({
    handshake: {
      auth: {},
      query: { token: "query-token" },
      headers: {},
    },
  });
  assert.equal(token, null);
  assert.equal(
    readSocketToken({
      handshake: { auth: { token: "header-token" }, query: { token: "query-token" }, headers: {} },
    }),
    "header-token",
  );
});

test("logout revocation blocks that token and a user revocation blocks every token", () => {
  resetRevocationState();
  const token = signAccessToken("64b000000000000000000001");
  const session = readAccessToken(token);
  assert.ok(session);
  assert.equal(blockedInMemory(session), false);

  rememberRevocation(`jti:${session.jti}`, session.expiresAt);
  assert.equal(blockedInMemory(session), true);

  resetRevocationState();
  const other = readAccessToken(signAccessToken(session.userId));
  rememberRevocation(`user:${session.userId}`, session.expiresAt);
  assert.equal(blockedInMemory(session), true);
  assert.equal(blockedInMemory(other), true);
});

test("message status can only move forward", () => {
  assert.deepEqual(earlierStatuses("delivered"), ["sent"]);
  assert.deepEqual(earlierStatuses("read"), ["sent", "delivered"]);
  assert.equal(earlierStatuses("delivered").includes("read"), false);
});
