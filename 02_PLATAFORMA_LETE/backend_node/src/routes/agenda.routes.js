// src/routes/agenda.routes.js
import express from 'express';
// AGREGA createRecurringUnavailable AQUÍ ABAJO:
import { checkAvailability, getAgendaPorDia, createRecurringUnavailable } from '../controllers/agenda.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ruta para verificar la disponibilidad de un técnico
router.post('/check-availability', checkAvailability);

// Ruta para obtener la agenda del día
router.get('/por-dia', requireAuth, getAgendaPorDia);

// Ruta para bloquear tiempo (CORRECTA)
router.post('/bloquear-recurrente', requireAuth, createRecurringUnavailable);
// Nota: Le agregué requireAuth por seguridad, para que sepamos quién es el usuario (user.id)

export default router;