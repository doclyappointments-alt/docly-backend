// src/modules/notifications/notification.routes.ts
import { Router } from 'express';
import * as NotificationController from './notification.controller.js';
import { authenticate } from '@common/middleware/auth.js';
import { authorizeRoles } from '@common/middleware/authorizeRoles.js';

const router = Router();

router.post('/send', authenticate, NotificationController.sendNotification);
router.get('/me', authenticate, NotificationController.getMyNotifications);
router.get(
  '/user/:userId',
  authenticate,
  authorizeRoles('ADMIN'),
  NotificationController.getUserNotifications
);

export default router;
