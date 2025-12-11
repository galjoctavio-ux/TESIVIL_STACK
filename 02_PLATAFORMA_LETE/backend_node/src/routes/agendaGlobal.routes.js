// backend_node/src/routes/agendaGlobal.routes.js
import { Router } from 'express';
// 1. IMPORTAMOS LA NUEVA FUNCIÓN AQUI 👇
import {
    obtenerTecnicos,
    obtenerAgendaGlobal,
    actualizarUbicacionCita
} from '../controllers/agendaGlobal.controller.js';

import { verifyLinkToken } from '../middleware/linkAuth.middleware.js';

const router = Router();

// Aplicamos el cerrojo de seguridad a todas las rutas
router.use(verifyLinkToken);

// Rutas de lectura
router.get('/tecnicos', obtenerTecnicos);
router.get('/citas', obtenerAgendaGlobal);

// 2. NUEVA RUTA DE ESCRITURA (PUT) 👇
// Coincide con lo que pusimos en el Frontend: /citas/:id/location
router.put('/citas/:id/location', actualizarUbicacionCita);

export default router;