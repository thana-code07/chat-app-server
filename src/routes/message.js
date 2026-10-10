import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createMessage,
  getMessage,
  listChatMessages,
  patchMessageStatus,
} from "../controllers/messageController.js";

const router = Router();

router.post("/", requireAuth, createMessage);
router.get("/", requireAuth, listChatMessages);
router.get("/:messageId", requireAuth, getMessage);
router.patch("/:messageId", requireAuth, patchMessageStatus);

export default router;
