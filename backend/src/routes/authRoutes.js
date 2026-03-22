/**
 * authRoutes.js
 * -------------
 * §1 Auth API — mounted at /api/auth in server.js
 */

import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  register,
  registerAdminInvite,
  login,
  loginGoogle,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  logout,
} from '../controllers/authController.js';

const router = Router();

// 🔓 Public routes
router.post('/register',              register);
router.post('/register/admin-invite', registerAdminInvite);
router.post('/login',                 login);
router.post('/login/google',          loginGoogle);
router.post('/refresh',               refreshAccessToken);
router.post('/forgot-password',       forgotPassword);
router.post('/reset-password',        resetPassword);

// 🔒 Authenticated
router.post('/logout', authenticate, logout);

export default router;
