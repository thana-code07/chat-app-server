import { Router } from "express";
import { list, messages, open } from "../controllers/conversationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, list);
router.get("/with/:userId/messages", requireAuth, messages);
router.get("/with/:userId", requireAuth, open);

export default router;
