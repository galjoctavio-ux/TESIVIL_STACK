import { Router } from 'express';
import { loginUsuario, getMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Define el endpoint de login
// Ruta final será: POST /lete/api/auth/login
router.post('/login', loginUsuario);

// Define el endpoint para obtener los datos del usuario actual
// Ruta final será: GET /lete/api/auth/me
router.get('/me', requireAuth, getMe);

export default router;
