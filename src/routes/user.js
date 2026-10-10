import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitAuth } from "../middleware/rateLimit.js";
import {
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  touchLastSeen,
} from "../controllers/userController.js";

const router = Router();

router.post("/register", rateLimitAuth, register);
router.post("/login", rateLimitAuth, login);
router.post("/refresh", rateLimitAuth, refresh);
router.post("/logout", rateLimitAuth, logout);
router.post("/logout-all", requireAuth, logoutAll);
router.get("/me", requireAuth, me);
router.patch("/last-seen", requireAuth, touchLastSeen);

export default router;
