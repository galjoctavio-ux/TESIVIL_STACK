// src/routes/agenda.routes.js
import express from 'express';
import { checkAvailability, getAgendaPorDia } from '../controllers/agenda.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ruta para verificar la disponibilidad de un técnico
// POST /api/agenda/check-availability
router.post('/check-availability', checkAvailability);

// Nueva ruta para obtener la agenda del día para el técnico autenticado
router.get('/por-dia', requireAuth, getAgendaPorDia);

export default router;
