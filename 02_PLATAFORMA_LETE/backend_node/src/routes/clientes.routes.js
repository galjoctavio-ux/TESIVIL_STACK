import { Router } from 'express';
// 1. Mantenemos solo esta importación correcta
import { requireAuth, isAdmin } from '../middleware/auth.middleware.js';
import {
    buscarCliente, getHistorialCliente, getAdminDashboard,
    forceAnalyzeClient, getChatCliente
} from '../controllers/clientes.controller.js';
import { getCrmDashboardV2 } from '../controllers/crmDashboard.controller.js';
import { getCrmDashboardV3 } from '../controllers/crmDashboardV3.controller.js';

const router = Router();

router.get('/admin-dashboard', requireAuth, isAdmin, getAdminDashboard);
router.patch('/:id/force-analyze', requireAuth, isAdmin, forceAnalyzeClient);
router.get('/buscar', requireAuth, isAdmin, buscarCliente);
router.get('/:id/historial', requireAuth, isAdmin, getHistorialCliente);
router.get('/:id/chat', requireAuth, isAdmin, getChatCliente);

// Rutas V2 y V3
router.get('/admin-dashboard-v2', requireAuth, isAdmin, getCrmDashboardV2); // Agregué seguridad aquí también por si acaso
router.get('/admin-dashboard-v3', requireAuth, isAdmin, getCrmDashboardV3); // <--- CORREGIDO: Usamos requireAuth e isAdmin

export default router;