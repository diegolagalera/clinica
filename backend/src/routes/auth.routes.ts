import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middleware/index.js';

const router = Router();

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/me', authenticate, authController.updateMyInfo);
router.put('/change-password', authenticate, authController.changePassword);

// 2FA routes (ADMIN and SUPERADMIN only)
router.post('/2fa/setup', authenticate, requireAdmin, authController.setup2FA);
router.post('/2fa/verify', authenticate, requireAdmin, authController.verify2FA);
router.post('/2fa/disable', authenticate, requireAdmin, authController.disable2FA);

export default router;
