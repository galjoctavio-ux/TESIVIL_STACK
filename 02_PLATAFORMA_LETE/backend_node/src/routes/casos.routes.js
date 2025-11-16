import { Router } from 'express';
// IMPORTACIONES ACTUALIZADAS
import { requireAuth, isAdmin, isTecnico } from '../middleware/auth.middleware.js';

// --- MODIFICACIÓN: Importar el nuevo controlador ---
import { 
  getCasos, 
  createCaso, 
  updateCaso, 
  getCasoPublico, // <-- AÑADIDO
  createCasoFromCotizacion
} from '../controllers/casos.controller.js';

const router = Router();

// --- NUEVA RUTA PÚBLICA PARA MAGIC LINK ---
// (Sin authRequired, es pública pero segura por el token)
router.get(
  '/publico/:token', // Usamos el token como parámetro
  getCasoPublico
);
// ------------------------------------------

// RUTAS ACTUALIZADAS (Middleware por ruta)

// GET /lete/api/casos (Admin: ver todos | Tecnico: ver los suyos)
// Primero requireAuth, y LUEGO el controlador decidirá
router.get('/', requireAuth, getCasos);

// POST /lete/api/casos (Admin: crear nuevo)
// Solo para Admins
router.post('/', requireAuth, isAdmin, createCaso);

// PUT /lete/api/casos/:id (Admin: asignar técnico, cambiar status)
// Solo para Admins
router.put('/:id', requireAuth, isAdmin, updateCaso);

// --- RUTA NUEVA PARA CREAR CASO Y CITA DESDE COTIZACIÓN ---
router.post('/create-from-cotizacion', requireAuth, isAdmin, createCasoFromCotizacion);

export default router;
