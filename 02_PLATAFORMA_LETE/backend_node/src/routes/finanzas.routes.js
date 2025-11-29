import { Router } from 'express';
import { requireAuth, isAdmin } from '../middleware/auth.middleware.js';
import {
    getResumenFinanciero,
    reportarPagoSemanal,
    aprobarTransaccion,
    otorgarBono
} from '../controllers/finanzas.controller.js';

const router = Router();

// Rutas para el Técnico
router.get('/resumen/:tecnicoId', requireAuth, getResumenFinanciero);
router.post('/reportar-pago', requireAuth, reportarPagoSemanal);

// Rutas para el Admin
router.put('/aprobar/:id', requireAuth, isAdmin, aprobarTransaccion);
router.post('/bono', requireAuth, isAdmin, otorgarBono);

export default router;