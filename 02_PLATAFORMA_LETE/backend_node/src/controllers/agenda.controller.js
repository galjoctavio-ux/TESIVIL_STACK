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
* (VERSIÓN FINAL OPTIMIZADA)
*/
export const getAgendaPorDia = async (req, res) => {
// 1. Obtenemos el ID del 'req.user' que inyectó el middleware 'requireAuth'
const tecnico_id = req.user.ea_user_id; // <-- Usamos el ID de ea_users (ej: 23)
const { fecha } = req.query; // Fecha en formato 'YYYY-MM-DD'

if (!fecha) {
return res.status(400).json({ error: 'El parámetro "fecha" es requerido.' });
}

try {
// 2. Preparamos el rango de fechas (esto usa los índices y es rápido)
const fechaInicio = `${fecha} 00:00:00`;
const fechaSiguiente = new Date(fecha);
fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
const fechaFin = fechaSiguiente.toISOString().split('T')[0] + ' 00:00:00';

const connection = await pool.getConnection();

// 3. LA QUERY CORREGIDA:
// - Eliminamos TODOS los LEFT JOINs.
// - Seleccionamos los campos 'notes' y 'notas_estructuradas'.
const sql = `
SELECT
id,
start_datetime,
end_datetime,
notes,
notas_estructuradas
FROM ea_appointments
WHERE
id_users_provider = ?
AND start_datetime >= ?
AND start_datetime < ?
ORDER BY start_datetime ASC;
`;

const params = [tecnico_id, fechaInicio, fechaFin];

const [rows] = await connection.execute(sql, params);
connection.release();

// 4. PROCESAMIENTO EN JAVASCRIPT
// Aquí es donde "encontramos" el caso_id
const citas = rows.map(cita => {
let casoId = null;

// Intento 1: Asumir que 'notas_estructuradas' es un JSON
if (cita.notas_estructuradas) {
try {
// Asumimos que guardas algo como: {"caso_id": 123, "otro": "dato"}
const structured = JSON.parse(cita.notas_estructuradas);
if (structured.caso_id) {
casoId = structured.caso_id;
}
} catch (e) {
// No era un JSON válido, no hacemos nada.
}
}

// Intento 2: Si no se encontró, buscar en 'notes' (menos probable)
// Asumimos que guardas algo como "ID del Caso: C-45"
if (!casoId && cita.notes) {
const match = cita.notes.match(/ID del Caso: (\S+)/); // <-- AJUSTA ESTE REGEX SI ES NECESARIO
if (match && match[1]) {
casoId = match[1];
}
}

// 5. Devolvemos el formato que el frontend espera
return {
id: cita.id,
start_datetime: cita.start_datetime,
end_datetime: cita.end_datetime,
caso_id: casoId // Será null si no se encontró en ningún lado
};
});

res.json(citas);

} catch (error) {
console.error('Error al obtener la agenda por día:', error);
res.status(500).json({
error: 'Error interno del servidor al obtener la agenda.',
details: error.message
});
}
};
