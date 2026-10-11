import { findUsersByName } from "../services/userService.js";
import { readUserQuery } from "../validation/directory.js";

function sendServiceError(err, res) {
  if (!err.status) throw err;
  return res.status(err.status).json({
    error: { code: err.code, message: err.message },
  });
}

export async function searchUsers(req, res) {
  const parsed = readUserQuery(req.query);
  if (parsed.error) {
    return res.status(422).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error },
    });
  }

  try {
    const users = await findUsersByName({ userId: req.userId, q: parsed.q });
    return res.json({ users });
  } catch (err) {
    return sendServiceError(err, res);
  }
}
