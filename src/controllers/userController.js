import {
  getCurrentUser,
  loginUser,
  logoutUser,
  readLogoutToken,
  registerUser,
  updateLastSeen,
} from "../services/userService.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

function validateCredentials(body) {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  const { username, password } = body;
  if (typeof username !== "string" || !USERNAME_RE.test(username.trim())) {
    return "Username must be 3-32 characters and use only letters, numbers, and underscores";
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return "Password must be 8-72 characters";
  }
  return null;
}

function sendServiceError(err, res) {
  if (!err.status) throw err;
  return res.status(err.status).json({
    error: { code: err.code, message: err.message },
  });
}

export async function register(req, res) {
  const message = validateCredentials(req.body);
  if (message) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message },
    });
  }

  try {
    const session = await registerUser({
      username: req.body.username.trim(),
      password: req.body.password,
    });
    return res.status(201).json(session);
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function login(req, res) {
  const message = validateCredentials(req.body);
  if (message) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message },
    });
  }

  try {
    const session = await loginUser({
      username: req.body.username.trim(),
      password: req.body.password,
    });
    return res.json(session);
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function logout(req, res) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = readLogoutToken(token);
  if (!session) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  await logoutUser(session);
  return res.json({ ok: true });
}

export async function me(req, res) {
  try {
    const user = await getCurrentUser(req.userId);
    return res.json({ user });
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function touchLastSeen(req, res) {
  try {
    const user = await updateLastSeen(req.userId);
    return res.json({ user });
  } catch (err) {
    return sendServiceError(err, res);
  }
}
