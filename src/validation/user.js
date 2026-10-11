export const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
export const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function readBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }
  return null;
}

function readUsername(body) {
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!USERNAME_RE.test(username)) {
    return {
      error: "Username must be 3-32 characters and use only letters, numbers, and underscores",
    };
  }
  return { username };
}

function readPassword(body) {
  const password = typeof body.password === "string" ? body.password : "";
  const bytes = Buffer.byteLength(password);
  if (password.length < 8 || bytes > 72) {
    return { error: "Password must be at least 8 characters and no more than 72 bytes" };
  }
  return { password };
}

export function readEmail(body) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email address" };
  }
  return { email };
}

export function readLogin(body) {
  const invalid = readBody(body);
  if (invalid) return invalid;

  const username = readUsername(body);
  if (username.error) return username;
  const password = readPassword(body);
  if (password.error) return password;
  return { username: username.username, password: password.password };
}

export function readRegister(body) {
  const invalid = readBody(body);
  if (invalid) return invalid;

  const username = readUsername(body);
  if (username.error) return username;
  const email = readEmail(body);
  if (email.error) return email;
  const password = readPassword(body);
  if (password.error) return password;
  return {
    username: username.username,
    email: email.email,
    password: password.password,
  };
}
