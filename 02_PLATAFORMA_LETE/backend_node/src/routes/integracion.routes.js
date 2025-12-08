// src/routes/integracion.routes.js
import { Router } from 'express';
// Importamos nuestro guardián
import { requireApiKey } from '../middleware/apiAuth.middleware.js';
// Importamos la lógica
import { agendarDesdeBot } from '../controllers/integracion.controller.js';

const router = Router();

// Definimos la ruta POST
// URL Final será: /lete/api/integracion/crear-caso-bot
router.post('/crear-caso-bot', requireApiKey, agendarDesdeBot);

export default router;