// src/modules/chat/chat.routes.ts
import { Router } from 'express';
import { postMessage, getMessages } from './chat.controller.js';
//import { authenticate } from '@common/middleware/auth.js';

const router = Router();

//router.post("/", authenticate, postMessage);
//router.get("/", authenticate, getMessages);

// No authentication for now
router.post('/', postMessage);
router.get('/', getMessages);

export default router;
