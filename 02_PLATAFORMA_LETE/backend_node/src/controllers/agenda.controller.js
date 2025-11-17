// src/controllers/agenda.controller.js
import pool from '../services/eaDatabase.js';

/**
 * Verifica si un técnico tiene conflictos de agenda en un rango de fechas.
 */
export const checkAvailability = async (req, res) => {
  const { tecnico_id, fecha_inicio, fecha_fin } = req.body;

  // 1. Validación de Entrada
  if (!tecnico_id || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({
      hasConflict: true, // Por seguridad, asumimos conflicto si faltan datos
      details: 'Faltan parámetros requeridos (tecnico_id, fecha_inicio, fecha_fin).',
    });
  }

  try {
    const connection = await pool.getConnection();

    // 2. Lógica de la consulta
    const sql = `
        SELECT id, start_datetime, end_datetime
        FROM ea_appointments
        WHERE id_users_provider = ?
          AND is_unavailable = 0
          AND start_datetime < ?   -- La cita existente empieza ANTES de que termine la nueva
          AND end_datetime > ?     -- La cita existente termina DESPUÉS de que empiece la nueva
        LIMIT 1;
    `;

    // Parámetros para la consulta
    const params = [tecnico_id, fecha_fin, fecha_inicio];

    const [rows] = await connection.execute(sql, params);
    connection.release();

    // 3. Responder al cliente
    if (rows.length > 0) {
      // Si hay al menos una fila, hay un conflicto
      res.json({
        hasConflict: true,
        details: `Conflicto con cita existente ID: ${rows[0].id}. Horario: ${rows[0].start_datetime} a ${rows[0].end_datetime}`,
      });
    } else {
      // Si no hay filas, el horario está disponible
      res.json({ hasConflict: false });
    }

  } catch (error) {
    console.error('Error al verificar la disponibilidad:', error);
    res.status(500).json({
        hasConflict: true, // Asumimos conflicto en caso de error
        details: 'Error interno del servidor al consultar la agenda.',
        error: error.message
    });
  }
};

/**
 * Obtiene todas las citas de un técnico para un día específico.
 */
export const getAgendaPorDia = async (req, res) => {
  const tecnico_id = req.user.id; // ID del técnico inyectado por requireAuth
  const { fecha } = req.query; // Fecha en formato 'YYYY-MM-DD'

  if (!fecha) {
    return res.status(400).json({
      error: 'El parámetro "fecha" es requerido.',
    });
  }

  try {
    const connection = await pool.getConnection();

    // La query busca todas las citas para el proveedor y la fecha especificada.
    // Hacemos un LEFT JOIN con ea_appointments_cases para obtener el caso_id si existe.
    const sql = `
      SELECT
        a.id,
        a.start_datetime,
        a.end_datetime,
        ac.caso_id
      FROM ea_appointments a
      LEFT JOIN ea_appointments_cases ac ON a.id = ac.appointment_id
      WHERE a.id_users_provider = ?
        AND DATE(a.start_datetime) = ?
      ORDER BY a.start_datetime ASC;
    `;

    const params = [tecnico_id, fecha];

    const [rows] = await connection.execute(sql, params);
    connection.release();

    res.json(rows);

  } catch (error) {
    console.error('Error al obtener la agenda por día:', error);
    res.status(500).json({
      error: 'Error interno del servidor al obtener la agenda.',
      details: error.message
    });
  }
};
