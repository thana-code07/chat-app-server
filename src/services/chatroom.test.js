import assert from "node:assert/strict";
import test from "node:test";
import { pairChatroomId } from "./chatroom.js";

test("a pair of users always shares one chat room", () => {
  const ada = "64b000000000000000000001";
  const bob = "64b000000000000000000002";
  const room = pairChatroomId(ada, bob);

  assert.equal(room, pairChatroomId(bob, ada));
  assert.equal(room, pairChatroomId(ada, bob));
  assert.notEqual(room, pairChatroomId(ada, "64b000000000000000000003"));
  assert.match(room, /^[a-f0-9]{24}$/);
});
