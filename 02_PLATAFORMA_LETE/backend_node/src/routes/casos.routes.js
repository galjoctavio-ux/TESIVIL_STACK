import { Router } from 'express';
import { requireAuth, isAdmin, isTecnico } from '../middleware/auth.middleware.js';

import {
  getCasos,
  createCaso,
  updateCaso,
  getCasoById,
  createCasoFromCotizacion,
  cerrarCasoManualTecnico,
  cerrarCaso,
  getDetalleTecnico // Asegúrate de que esto esté importado
} from '../controllers/casos.controller.js';

const router = Router();

// 1. GET /lete/api/casos (Listar todos)
router.get('/', requireAuth, getCasos);

// 🔥 CORRECCIÓN: La ruta ESPECÍFICA va PRIMERO
// Si la pones al final, Express podría confundirse o no llegar a ella correctamente.
router.get('/:id/expediente', requireAuth, isTecnico, getDetalleTecnico);

// 2. GET /lete/api/casos/:id (Buscar uno genérico)
// Esta captura cualquier ID, por eso debe ir DESPUÉS de la de expediente
router.get('/:id', requireAuth, getCasoById);

// POST /lete/api/casos (Admin: crear nuevo)
router.post('/', requireAuth, isAdmin, createCaso);

// PUT /lete/api/casos/:id (Admin: asignar técnico, cambiar status)
router.put('/:id', requireAuth, isAdmin, updateCaso);

// Ruta para crear desde cotización
router.post('/create-from-cotizacion', requireAuth, isAdmin, createCasoFromCotizacion);

// Rutas de cierre
router.patch('/:id/cerrar-manual', requireAuth, isTecnico, cerrarCasoManualTecnico);
router.patch('/:id/cerrar', requireAuth, isTecnico, cerrarCaso);

export default router;