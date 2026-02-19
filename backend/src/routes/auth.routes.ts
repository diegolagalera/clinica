import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middleware/index.js';

const router = Router();

// Strict rate limiter for token refresh — prevents brute-force attacks
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Max 30 refresh attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many refresh attempts, please try again later.' },
});

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', refreshLimiter, authController.refreshToken);
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
