import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitMessages } from "../middleware/rateLimit.js";
import {
  createMessage,
  getMessage,
  listChatMessages,
  patchMessageStatus,
} from "../controllers/messageController.js";

const router = Router();

router.post("/", requireAuth, rateLimitMessages, createMessage);
router.get("/", requireAuth, listChatMessages);
router.get("/:messageId", requireAuth, getMessage);
router.patch("/:messageId", requireAuth, rateLimitMessages, patchMessageStatus);

export default router;
