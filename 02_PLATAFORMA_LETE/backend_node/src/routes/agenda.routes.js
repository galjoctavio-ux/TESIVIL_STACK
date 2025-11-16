// src/routes/agenda.routes.js
import express from 'express';
import { checkAvailability } from '../controllers/agenda.controller.js';
// (Aquí irían middlewares de autenticación si fueran necesarios)

const router = express.Router();

// Ruta para verificar la disponibilidad de un técnico
// POST /api/agenda/check-availability
router.post('/check-availability', checkAvailability);

export default router;
