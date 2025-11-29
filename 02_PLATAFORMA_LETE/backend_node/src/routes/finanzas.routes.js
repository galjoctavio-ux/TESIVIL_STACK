import { Router } from 'express';
import { requireAuth, isAdmin } from '../middleware/auth.middleware.js';
import {
    getResumenFinanciero,
    reportarPagoSemanal,
    aprobarTransaccion,
    otorgarBono,
    reportarGasto
} from '../controllers/finanzas.controller.js';

const router = Router();

// Rutas para el Técnico
router.get('/resumen/:tecnicoId', requireAuth, getResumenFinanciero);
router.post('/reportar-pago', requireAuth, reportarPagoSemanal);
router.post('/reportar-gasto', requireAuth, reportarGasto);

// Rutas para el Admin
router.put('/aprobar/:id', requireAuth, isAdmin, aprobarTransaccion);
router.post('/bono', requireAuth, isAdmin, otorgarBono);

export default router;