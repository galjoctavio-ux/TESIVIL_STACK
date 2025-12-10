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
    console.log(`\n--- 🔍 DEBUG AGENDA: Solicitud para ${fecha} ---`);

    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

    try {
        const connection = await pool.getConnection();
        const startOfDay = `${fecha} 00:00:00`;
        const endOfDay = `${fecha} 23:59:59`;

        // 1. Consulta MariaDB
        const sql = `
      SELECT 
        a.id, a.start_datetime, a.notas_estructuradas,
        a.id_users_provider, a.is_unavailable,
        prov.first_name as tecnico_nombre,
        cust.first_name as ea_cliente_nombre,
        cust.last_name as ea_cliente_apellido
      FROM ea_appointments a
      JOIN ea_users prov ON a.id_users_provider = prov.id
      LEFT JOIN ea_users cust ON a.id_users_customer = cust.id
      WHERE a.start_datetime >= ? AND a.start_datetime <= ?
        AND prov.id_roles = 2
    `;

        const [rows] = await connection.execute(sql, [startOfDay, endOfDay]);
        connection.release();

        console.log(`✅ MariaDB: Encontradas ${rows.length} citas.`);

        // 2. Extraer IDs
        const citas = rows.map(cita => {
            let casoId = null;
            if (cita.notas_estructuradas) {
                try {
                    const structured = JSON.parse(cita.notas_estructuradas);
                    if (structured.caso_id) casoId = structured.caso_id;
                } catch (e) { console.log('Error parse JSON:', e.message); }
            }
            // LOG DE CADA CITA
            console.log(`   🔸 Cita ID ${cita.id}: CasoID=${casoId} | EA_Cliente=${cita.ea_cliente_nombre || 'NULL'}`);
            return { ...cita, caso_id: casoId };
        });

        const casoIds = citas.map(c => c.caso_id).filter(id => id !== null);
        console.log(`📋 IDs para Supabase: [${casoIds.join(', ')}]`);

        // 3. Consultar Supabase
        let casosMap = new Map();
        if (casoIds.length > 0) {
            console.log('🚀 Consultando Supabase...');

            const { data: casosData, error } = await supabaseAdmin
                .from('casos')
                .select(`
        id, tipo_servicio,
        cliente:clientes (nombre_completo, telefono, celular, direccion_principal, google_maps_link)
    `) // <-- SE AGREGÓ 'celular' AQUÍ
                .in('id', casoIds);

            if (error) {
                console.error('❌ ERROR SUPABASE:', error);
            } else {
                console.log(`✅ Supabase respondió ${casosData.length} registros.`);
                // LOG DETALLADO DE LO QUE LLEGÓ
                casosData.forEach(c => {
                    console.log(`      🔹 Caso ${c.id}: Cliente? ${c.cliente ? 'SI' : 'NO (NULL)'} ->`, c.cliente);
                });
                casosMap = new Map(casosData.map(c => [c.id, c]));
            }
        }

        // 4. Armar respuesta (código simplificado para debug, pero funcional)
        const agenda = citas.map(cita => {
            const caso = casosMap.get(cita.caso_id);

            // 1. Datos base
            let titulo = cita.is_unavailable ? 'BLOQUEO / SIN DATOS' : 'OCUPADO';
            let nombreCliente = '';
            let celular = ''; // <--- Variable a llenar
            let direccion = '';
            let mapsLink = '';
            let tipoServicio = '';

            // 2. Intentar sacar datos de Easy!Appointments (Respaldo)
            if (cita.ea_cliente_nombre) {
                nombreCliente = `${cita.ea_cliente_nombre} ${cita.ea_cliente_apellido || ''}`.trim();
                // Priorizar el celular de EA si existe, sino el teléfono
                celular = cita.ea_cliente_celular || cita.ea_cliente_telefono || '';
                direccion = cita.ea_cliente_direccion || '';
                titulo = nombreCliente;
            }

            // 3. Si existe en Supabase, SOBREESCRIBIMOS con datos mejores (Prioridad)
            if (caso && caso.cliente) {
                nombreCliente = caso.cliente.nombre_completo || nombreCliente;
                // El celular de Supabase tiene la máxima prioridad
                celular = caso.cliente.celular || caso.cliente.telefono || celular;
                direccion = caso.cliente.direccion_principal || direccion;
                mapsLink = caso.cliente.google_maps_link || '';
                titulo = nombreCliente;
                tipoServicio = caso.tipo_servicio;
            }

            return {
                id: cita.id,
                resourceId: cita.id_users_provider,
                title: titulo,
                start: dayjs(cita.start_datetime).format('YYYY-MM-DD HH:mm:ss'),
                // ... (resto de campos requeridos por el frontend, simplificados aquí)
                end: dayjs(cita.start_datetime).add(1, 'hour').format('YYYY-MM-DD HH:mm:ss'), // Temporal si no trajiste end_datetime
                type: 'appointment',
                details: {
                    cliente: nombreCliente,
                    celular: celular, // <--- CAMPO ENVIADO AL FRONTEND
                    direccion: direccion,
                    mapsLink: mapsLink,
                    tipoServicio: tipoServicio,
                    notas: cita.notes || ''
                }
            };
        });

        res.json(agenda);

    } catch (error) {
        console.error('🔥 CRASH:', error);
        res.status(500).json({ error: error.message });
    }
};