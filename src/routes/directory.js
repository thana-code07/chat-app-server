import { Router } from "express";
import { searchUsers } from "../controllers/directoryController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/search", requireAuth, searchUsers);

export default router;
