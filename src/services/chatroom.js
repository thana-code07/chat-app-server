import { createHash } from "node:crypto";

// Both people in a direct chat must share one room, whichever side sends first.
export function pairChatroomId(a, b) {
  const [left, right] = [String(a), String(b)].sort();
  return createHash("sha256").update(`${left}:${right}`).digest("hex").slice(0, 24);
}
