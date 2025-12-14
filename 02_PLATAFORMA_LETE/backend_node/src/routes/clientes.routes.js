import { Router } from 'express';
import { requireAuth, isAdmin } from '../middleware/auth.middleware.js';
import {
    buscarCliente, getHistorialCliente, getAdminDashboard, // <--- Importa la nueva función
    forceAnalyzeClient, getChatCliente
} from '../controllers/clientes.controller.js';
import { getCrmDashboardV2 } from '../controllers/crmDashboard.controller.js';

const router = Router();

// 👇 RUTA NUEVA PARA EL DASHBOARD
router.get('/admin-dashboard', requireAuth, isAdmin, getAdminDashboard);
router.patch('/:id/force-analyze', requireAuth, isAdmin, forceAnalyzeClient);
router.get('/buscar', requireAuth, isAdmin, buscarCliente);
router.get('/:id/historial', requireAuth, isAdmin, getHistorialCliente);
router.get('/:id/chat', requireAuth, isAdmin, getChatCliente);
router.get('/admin-dashboard-v2', getCrmDashboardV2); // <--- NUEVA RUTA
export default router;