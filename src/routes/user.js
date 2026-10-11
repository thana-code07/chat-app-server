import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitAuth } from "../middleware/rateLimit.js";
import {
  login,
  logout,
  me,
  register,
  touchLastSeen,
} from "../controllers/userController.js";

const router = Router();

router.post("/register", rateLimitAuth, register);
router.post("/login", rateLimitAuth, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.patch("/last-seen", requireAuth, touchLastSeen);

export default router;
