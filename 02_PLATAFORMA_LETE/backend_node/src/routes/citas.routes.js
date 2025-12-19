import express from 'express';
// 1. BORRAMOS la línea de authMiddleware que daba error
import eaPool from '../services/eaDatabase.js';
// 2. MANTENEMOS esta que es la correcta
import { requireAuth } from '../middleware/auth.middleware.js';
import { randomBytes } from 'crypto';

const router = express.Router();

// GET /citas/disponibilidad
router.get('/disponibilidad', requireAuth, async (req, res) => {
  // ... (tu código sigue igual) ...
  const { tecnico_id, fecha } = req.query;
  // ...
  // (Resumen del código para no copiar todo de nuevo)
   try {
    const sqlDate = new Date(fecha).toISOString().split('T')[0];
    const sql = `SELECT TIME(start_datetime) AS hora_inicio, TIME(end_datetime) AS hora_fin FROM ea_appointments WHERE id_users_provider = ? AND DATE(start_datetime) = ?;`;
    const [rows] = await eaPool.query(sql, [tecnico_id, sqlDate]);
    const horariosOcupados = rows.map(cita => ({ inicio: cita.hora_inicio.substring(0, 5), fin: cita.hora_fin.substring(0, 5) }));
    res.json(horariosOcupados);
  } catch (error) {
    res.status(500).json({ message: 'Error al consultar disponibilidad.' });
  }
});

// POST /citas
router.post('/', requireAuth, async (req, res) => {
  // ... (tu código sigue igual, ya usa requireAuth correctamente) ...
   const { caso_id, tecnico_id_ea, fecha, hora, duracion_horas, direccion_legible, link_gmaps, notas_adicionales } = req.body;
   // ... validaciones y lógica ...
   try {
    // ... lógica de inserción ...
    const start_datetime = `${fecha} ${hora}:00`;
    // ...
    // (Resumen para brevedad)
    res.status(201).json({ success: true, message: 'Cita agendada exitosamente.' });
   } catch (error) {
    res.status(500).json({ message: error.message });
   }
});

export default router;