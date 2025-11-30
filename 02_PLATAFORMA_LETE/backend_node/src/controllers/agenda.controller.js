// src/controllers/agenda.controller.js
import pool from '../services/eaDatabase.js';
import dayjs from 'dayjs';
import { supabaseAdmin } from '../services/supabaseClient.js';

/**
 * Verifica si un técnico tiene conflictos de agenda en un rango de fechas.
 */
export const checkAvailability = async (req, res) => {
  const { tecnico_id, fecha_inicio, fecha_fin } = req.body;

  if (!tecnico_id || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({
      hasConflict: true,
      details: 'Faltan parámetros requeridos (tecnico_id, fecha_inicio, fecha_fin).',
    });
  }

  try {
    const connection = await pool.getConnection();

    const sql = `
        SELECT id, start_datetime, end_datetime
        FROM ea_appointments
        WHERE id_users_provider = ?
          AND is_unavailable = 0
          AND start_datetime < ?
          AND end_datetime > ?
        LIMIT 1;
    `;

    const params = [tecnico_id, fecha_fin, fecha_inicio];
    const [rows] = await connection.execute(sql, params);
    connection.release();

    if (rows.length > 0) {
      res.json({
        hasConflict: true,
        details: `Conflicto con cita existente ID: ${rows[0].id}.`,
      });
    } else {
      res.json({ hasConflict: false });
    }

  } catch (error) {
    console.error('Error al verificar la disponibilidad:', error);
    res.status(500).json({
      hasConflict: true,
      details: 'Error interno del servidor.',
      error: error.message
    });
  }
};

/**
* Obtiene todas las citas de un técnico para un día específico.
* (VERSIÓN ENRIQUECIDA CON DETALLES DE SUPABASE + CLIENTES)
*/
export const getAgendaPorDia = async (req, res) => {
  // Manejo robusto del ID de usuario
  const tecnico_id = req.user.ea_user_id || req.user.id_ea;
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
    // PASO 2: Procesar citas y extraer caso_id
    // ----------------------------------------------------
    const citas = rows.map(cita => {
      let casoId = null;
      if (cita.notas_estructuradas) {
        try {
          const structured = JSON.parse(cita.notas_estructuradas);
          if (structured.caso_id) casoId = structured.caso_id;
        } catch (e) { /* Ignorar errores de JSON */ }
      }
      return {
        id: cita.id,
        start_datetime: cita.start_datetime,
        end_datetime: cita.end_datetime,
        caso_id: casoId
      };
    });

    if (citas.length === 0) {
      return res.json([]);
    }

    // ----------------------------------------------------
    // PASO 3: Enriquecer con datos de Supabase (¡CORREGIDO!)
    // ----------------------------------------------------
    const casoIds = citas.map(c => c.caso_id).filter(id => id !== null);

    if (casoIds.length === 0) {
      return res.json(citas.map(c => ({ ...c, caso: null })));
    }

    // --- AQUÍ ESTÁ LA CORRECCIÓN CLAVE ---
    // Usamos la relación para traer los datos del cliente desde la tabla 'clientes'
    // --- CAMBIO AQUÍ: Agregamos 'telefono' y 'celular' al select ---
    const { data: casosData, error: casosError } = await supabaseAdmin
      .from('casos')
      .select(`
        id, 
        status, 
        tipo_servicio, 
        cliente:clientes (
          nombre_completo, 
          direccion_principal,
          google_maps_link,
          telefono,
          celular
        )
      `)
      .in('id', casoIds);

    if (casosError) throw casosError;

    // Mapa para cruzar datos
    const casosMap = new Map(casosData.map(caso => [caso.id, caso]));

    // ----------------------------------------------------
    // PASO 4: Fusionar y Enviar
    // ----------------------------------------------------
    const citasConDetalles = citas.map(cita => ({
      ...cita,
      start_datetime: dayjs(cita.start_datetime).format('YYYY-MM-DD HH:mm:ss'),
      end_datetime: dayjs(cita.end_datetime).format('YYYY-MM-DD HH:mm:ss'),
      // Añadimos el objeto caso enriquecido con cliente
      caso: casosMap.get(cita.caso_id) || null
    }));

    res.json(citasConDetalles);

  } catch (error) {
    console.error('Error al obtener la agenda enriquecida:', error);
    res.status(500).json({
      error: 'Error interno del servidor.',
      details: error.message
    });
  }
};