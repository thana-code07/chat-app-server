export function readConversationCursor(value) {
  if (value === undefined || value === "") return { before: null };
  if (typeof value !== "string") return { error: "before must be a conversation cursor" };
  const split = value.lastIndexOf("|");
  if (split <= 0) return { error: "before must be a conversation cursor" };
  const at = new Date(value.slice(0, split));
  const partnerId = value.slice(split + 1);
  if (Number.isNaN(at.getTime()) || !/^[a-f0-9]{24}$/.test(partnerId)) {
    return { error: "before must be a conversation cursor" };
  }
  return { before: { at, partnerId } };
}

export function readUserQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return { error: "q must be a string" };
  }
  if (query.q === undefined) return { q: "" };
  if (typeof query.q !== "string") return { error: "q must be a string" };
  const q = query.q.trim().toLowerCase();
  if (q.length > 32) return { error: "q must be at most 32 characters" };
  return { q };
}

export function readPage(query) {
  const page = query?.page === undefined ? 1 : Number(query.page);
  const pageSize = query?.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(page) || page < 1 || page > 100) {
    return { error: "page must be an integer from 1 to 100" };
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return { error: "pageSize must be an integer from 1 to 50" };
  }
  return { page, pageSize };
}
