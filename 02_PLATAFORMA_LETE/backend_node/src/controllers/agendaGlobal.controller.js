// backend_node/src/controllers/agendaGlobal.controller.js
import pool from '../services/eaDatabase.js';
import dayjs from 'dayjs';
import { supabaseAdmin } from '../services/supabaseClient.js';

/**
 * Obtiene lista de técnicos
 */
export const obtenerTecnicos = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const sql = `
      SELECT id, first_name, last_name, email, mobile_number
      FROM ea_users 
      WHERE id_roles = 2 
      ORDER BY first_name ASC
    `;
        const [rows] = await connection.execute(sql);
        connection.release();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener técnicos' });
    }
};

/**
 * Obtiene Agenda Global enriquecida con datos de Supabase
 */
export const obtenerAgendaGlobal = async (req, res) => {
    const { fecha } = req.query;

    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

    try {
        const connection = await pool.getConnection();
        const startOfDay = `${fecha} 00:00:00`;
        const endOfDay = `${fecha} 23:59:59`;

        // 1. Obtener Citas Base de MariaDB (Incluimos notas_estructuradas)
        const sql = `
      SELECT 
        a.id, a.start_datetime, a.end_datetime, a.id_users_provider, a.is_unavailable, 
        a.notas_estructuradas,
        u.first_name
      FROM ea_appointments a
      JOIN ea_users u ON a.id_users_provider = u.id
      WHERE a.start_datetime >= ? AND a.start_datetime <= ?
        AND u.id_roles = 2
      ORDER BY a.start_datetime ASC
    `;

        const [rows] = await connection.execute(sql, [startOfDay, endOfDay]);
        connection.release();

        // 2. Extraer IDs de casos para consultar Supabase en lote
        const citas = rows.map(cita => {
            let casoId = null;
            if (cita.notas_estructuradas) {
                try {
                    const structured = JSON.parse(cita.notas_estructuradas);
                    if (structured.caso_id) casoId = structured.caso_id;
                } catch (e) { /* Ignorar error de parseo */ }
            }
            return { ...cita, caso_id: casoId };
        });

        const casoIds = citas.map(c => c.caso_id).filter(id => id !== null);

        // 3. Consultar Supabase (si hay casos vinculados)
        let casosMap = new Map();
        if (casoIds.length > 0) {
            const { data: casosData, error } = await supabaseAdmin
                .from('casos')
                .select(`
          id,
          tipo_servicio,
          cliente:clientes (
            nombre_completo,
            telefono,
            celular,
            direccion_principal,
            google_maps_link
          )
        `)
                .in('id', casoIds);

            if (!error && casosData) {
                casosMap = new Map(casosData.map(c => [c.id, c]));
            }
        }

        // 4. Formatear respuesta final
        const agenda = citas.map(cita => {
            const caso = casosMap.get(cita.caso_id);

            // Título inteligente: Si hay cliente, mostramos nombre, si no, lo que diga EasyAppts
            let titulo = cita.is_unavailable ? 'BLOQUEO' : 'OCUPADO';
            let celular = '';
            let direccion = '';
            let mapsLink = '';
            let clienteNombre = '';

            if (caso && caso.cliente) {
                titulo = caso.cliente.nombre_completo || 'Cliente Sin Nombre';
                clienteNombre = caso.cliente.nombre_completo;
                celular = caso.cliente.celular || caso.cliente.telefono || '';
                direccion = caso.cliente.direccion_principal || '';
                mapsLink = caso.cliente.google_maps_link || '';
            }

            return {
                id: cita.id,
                resourceId: cita.id_users_provider,
                title: titulo,
                start: dayjs(cita.start_datetime).format('YYYY-MM-DD HH:mm:ss'),
                end: dayjs(cita.end_datetime).format('YYYY-MM-DD HH:mm:ss'),
                type: cita.is_unavailable ? 'blocked' : 'appointment',
                tecnico: cita.first_name,
                // Datos extra para el Popup
                details: {
                    cliente: clienteNombre,
                    celular: celular,
                    direccion: direccion,
                    mapsLink: mapsLink,
                    tipoServicio: caso?.tipo_servicio || ''
                }
            };
        });

        res.json(agenda);
    } catch (error) {
        console.error('Error agenda global:', error);
        res.status(500).json({ error: 'Error interno' });
    }
};