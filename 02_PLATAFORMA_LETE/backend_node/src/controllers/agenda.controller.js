// src/controllers/agenda.controller.js
import pool from '../services/eaDatabase.js';
// ¡IMPORTANTE! Asegúrate de importar supabaseAdmin
import { supabaseAdmin } from '../services/supabaseClient.js';

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
* (VERSIÓN ENRIQUECIDA CON DETALLES DE SUPABASE)
*/
export const getAgendaPorDia = async (req, res) => {
const tecnico_id = req.user.ea_user_id; // Usamos el ID de E!A (ej: 23)
const { fecha } = req.query;

if (!fecha) {
return res.status(400).json({ error: 'El parámetro "fecha" es requerido.' });
}

try {
// ----------------------------------------------------
// PASO 1: Obtener citas de Easy!Appointments (MySQL)
// ----------------------------------------------------
const fechaInicio = `${fecha} 00:00:00`;
const fechaSiguiente = new Date(fecha);
fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);
const fechaFin = fechaSiguiente.toISOString().split('T')[0] + ' 00:00:00';

const connection = await pool.getConnection();

const sql = `
SELECT id, start_datetime, end_datetime, notes, notas_estructuradas
FROM ea_appointments
WHERE id_users_provider = ?
AND start_datetime >= ?
AND start_datetime < ?
ORDER BY start_datetime ASC;
`;
const params = [tecnico_id, fechaInicio, fechaFin];
const [rows] = await connection.execute(sql, params);
connection.release();

// ----------------------------------------------------
// PASO 2: Procesar citas y extraer caso_id (Como antes)
// ----------------------------------------------------
const citas = rows.map(cita => {
let casoId = null;
if (cita.notas_estructuradas) {
try {
const structured = JSON.parse(cita.notas_estructuradas);
if (structured.caso_id) casoId = structured.caso_id;
} catch (e) { /* No es JSON, no pasa nada */ }
}
return {
id: cita.id, // ID de la cita
start_datetime: cita.start_datetime,
end_datetime: cita.end_datetime,
caso_id: casoId
};
});

// Si no hay citas, terminamos aquí
if (citas.length === 0) {
return res.json([]);
}

// ----------------------------------------------------
// PASO 3: Enriquecer con datos de Supabase
// ----------------------------------------------------

// 3.1. Obtener la lista de IDs de casos (ej: [37, 42])
const casoIds = citas.map(c => c.caso_id).filter(id => id !== null);

// Si no hay IDs de casos, no consultamos Supabase
if (casoIds.length === 0) {
// Devolvemos las citas (sin detalles de caso)
return res.json(citas.map(c => ({ ...c, caso: null })));
}

// 3.2. Consultar la tabla 'casos' en Supabase
const { data: casosData, error: casosError } = await supabaseAdmin
.from('casos')
.select('id, cliente_nombre, cliente_direccion, tipo, status') // Traemos los campos que necesitamos
.in('id', casoIds); // ¡Elige solo los casos de esta agenda!

if (casosError) throw casosError;

// 3.3. Crear un "Mapa" para cruzar datos fácilmente
const casosMap = new Map(casosData.map(caso => [caso.id, caso]));

// 3.4. Fusionar los datos de E!A (MySQL) con los de Casos (Supabase)
const citasConDetalles = citas.map(cita => ({
...cita, // Contiene id_cita, start_datetime, end_datetime, caso_id
// Añadimos un objeto 'caso' con los detalles
caso: casosMap.get(cita.caso_id) || null
}));

// ----------------------------------------------------
// PASO 4: Enviar la respuesta completa
// ----------------------------------------------------
res.json(citasConDetalles);

} catch (error) {
console.error('Error al obtener la agenda enriquecida:', error);
res.status(500).json({
error: 'Error interno del servidor al obtener la agenda.',
details: error.message
});
}
};
