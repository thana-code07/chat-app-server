import {
  getCurrentUser,
  loginUser,
  logoutUser,
  readLogoutToken,
  registerUser,
  updateLastSeen,
} from "../services/userService.js";
import { readLogin, readRegister } from "../validation/user.js";

function sendServiceError(err, res) {
  if (!err.status) throw err;
  return res.status(err.status).json({
    error: { code: err.code, message: err.message },
  });
}

export async function register(req, res) {
  const parsed = readRegister(req.body);
  if (parsed.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error },
    });
  }

  try {
    const session = await registerUser(parsed);
    return res.status(201).json(session);
  } catch (err) {
    return sendServiceError(err, res);
  }
}

export async function login(req, res) {
  const parsed = readLogin(req.body);
  if (parsed.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error },
    });
  }

  try {
    const session = await loginUser(parsed);
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
