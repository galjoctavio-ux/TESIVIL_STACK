import { Router } from 'express';
// IMPORTACIONES ACTUALIZADAS
import { requireAuth, isAdmin, isTecnico } from '../middleware/auth.middleware.js';

// --- MODIFICACIÓN: Importar el nuevo controlador ---
import {
  getCasos,
  createCaso,
  updateCaso,
  getCasoById, // <-- CAMBIADO
  createCasoFromCotizacion,
  cerrarCasoManualTecnico,
  cerrarCaso,
  getDetalleTecnico
} from '../controllers/casos.controller.js';

const router = Router();

// RUTAS ACTUALIZADAS (Middleware por ruta)

// GET /lete/api/casos (Admin: ver todos | Tecnico: ver los suyos)
// Primero requireAuth, y LUEGO el controlador decidirá
router.get('/', requireAuth, getCasos);

// --- NUEVA RUTA PROTEGIDA PARA OBTENER UN CASO POR ID ---
router.get('/:id', requireAuth, getCasoById);

// POST /lete/api/casos (Admin: crear nuevo)
// Solo para Admins
router.post('/', requireAuth, isAdmin, createCaso);

// PUT /lete/api/casos/:id (Admin: asignar técnico, cambiar status)
// Solo para Admins
router.put('/:id', requireAuth, isAdmin, updateCaso);

// --- RUTA NUEVA PARA CREAR CASO Y CITA DESDE COTIZACIÓN ---
router.post('/create-from-cotizacion', requireAuth, isAdmin, createCasoFromCotizacion);

// --- RUTA NUEVA Y SEGURA PARA CERRAR CASO (SOLO TÉCNICOS) ---
router.patch('/:id/cerrar-manual', requireAuth, isTecnico, cerrarCasoManualTecnico);

router.patch('/:id/cerrar', requireAuth, isTecnico, cerrarCaso);

router.get('/:id/expediente', requireAuth, isTecnico, getDetalleTecnico);

export default router;
