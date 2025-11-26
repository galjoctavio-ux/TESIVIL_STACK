import express from 'express';
import eaPool from '../services/eaDatabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { randomBytes } from 'crypto';

const router = express.Router();

// GET /citas/disponibilidad (Se mantiene igual, funciona bien)
router.get('/disponibilidad', requireAuth, async (req, res) => {
  const { tecnico_id, fecha } = req.query;

  if (!tecnico_id || !fecha) {
    return res.status(400).json({ message: 'El ID del técnico y la fecha son requeridos.' });
  }
  try {
    const sqlDate = new Date(fecha).toISOString().split('T')[0];
    const sql = `
      SELECT 
        TIME(start_datetime) AS hora_inicio, 
        TIME(end_datetime) AS hora_fin
      FROM ea_appointments
      WHERE id_users_provider = ?
        AND DATE(start_datetime) = ?;
    `;
    const [rows] = await eaPool.query(sql, [tecnico_id, sqlDate]);
    const horariosOcupados = rows.map(cita => ({
      inicio: cita.hora_inicio.substring(0, 5),
      fin: cita.hora_fin.substring(0, 5),
    }));
    res.json(horariosOcupados);
  } catch (error) {
    console.error('Error al consultar disponibilidad E!A:', error);
    res.status(500).json({ message: 'Error al consultar disponibilidad.' });
  }
});

// --- RUTA POST /citas (ADAPTADA AL NUEVO FLUJO) ---
router.post('/', requireAuth, async (req, res) => {
  const {
    caso_id,            // <--- AHORA RECIBIMOS EL ID DEL CASO EXISTENTE
    tecnico_id_ea,
    fecha,
    hora,
    duracion_horas,
    direccion_legible,
    link_gmaps,
    notas_adicionales
  } = req.body;

  // 1. Validaciones
  if (!caso_id || !tecnico_id_ea || !fecha || !hora) {
    return res.status(400).json({ message: 'Faltan datos clave para agendar (caso_id, tecnico, fecha, hora).' });
  }

  try {
    // 2. Preparar fechas para MySQL (YYYY-MM-DD HH:mm:ss)
    const start_datetime = `${fecha} ${hora}:00`;

    // Calcular fin sumando horas (usando Date nativo para evitar líos manuales)
    const startDateObj = new Date(start_datetime);
    const endDateObj = new Date(startDateObj.getTime() + (duracion_horas * 60 * 60 * 1000));

    // Formateador simple a string MySQL
    const pad = (n) => n.toString().padStart(2, '0');
    const toMySQLDate = (date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

    const start_datetime_mysql = toMySQLDate(startDateObj);
    const end_datetime_mysql = toMySQLDate(endDateObj);

    // 3. Preparar Datos E!A
    const notas_estructuradas = JSON.stringify({ caso_id: caso_id });
    const hash = randomBytes(16).toString('hex');
    const ID_CLIENTE_COMODIN = 21; // ID Genérico en E!A
    const ID_SERVICIO_DEFAULT = 1;

    // Notas visibles en el calendario
    const notasParaCalendario = `Caso #${caso_id} | ${notas_adicionales || ''}`;

    // 4. Insertar en E!A
    const sql = `
      INSERT INTO ea_appointments 
      (id_users_provider, id_services, id_users_customer, book_datetime, start_datetime, end_datetime, location, direccion_link, notes, notas_estructuradas, hash, is_unavailable)
      VALUES
      (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 0);
    `;

    const values = [
      tecnico_id_ea,
      ID_SERVICIO_DEFAULT,
      ID_CLIENTE_COMODIN,
      start_datetime_mysql,
      end_datetime_mysql,
      direccion_legible,
      link_gmaps,
      notasParaCalendario,
      notas_estructuradas,
      hash
    ];

    await eaPool.query(sql, values);
    console.log(`Cita agendada para Caso #${caso_id} en E!A.`);

    res.status(201).json({
      success: true,
      message: 'Cita agendada exitosamente.'
    });

  } catch (error) {
    console.error('Error al agendar cita:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;