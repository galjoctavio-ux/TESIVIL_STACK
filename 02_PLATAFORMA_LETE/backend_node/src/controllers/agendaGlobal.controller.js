// backend_node/src/controllers/agendaGlobal.controller.js
import pool from '../services/eaDatabase.js';
import dayjs from 'dayjs';
import { supabaseAdmin } from '../services/supabaseClient.js';

// ... (la función obtenerTecnicos la dejas igual) ...
export const obtenerTecnicos = async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const sql = `SELECT id, first_name, last_name FROM ea_users WHERE id_roles = 2 ORDER BY first_name ASC`;
        const [rows] = await connection.execute(sql);
        connection.release();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener técnicos' });
    }
};

export const obtenerAgendaGlobal = async (req, res) => {
    const { fecha } = req.query;

    if (!fecha) return res.status(400).json({ error: 'Fecha requerida' });

    try {
        const connection = await pool.getConnection();
        const startOfDay = `${fecha} 00:00:00`;
        const endOfDay = `${fecha} 23:59:59`;

        // 1. MariaDB
        const sql = `
      SELECT 
        a.id, a.start_datetime, a.end_datetime, a.id_users_provider, a.is_unavailable, 
        a.notas_estructuradas, a.notes,
        prov.first_name as tecnico_nombre,
        cust.first_name as ea_cliente_nombre,
        cust.last_name as ea_cliente_apellido,
        cust.mobile_number as ea_cliente_celular,
        cust.phone_number as ea_cliente_telefono,
        cust.address as ea_cliente_direccion
      FROM ea_appointments a
      JOIN ea_users prov ON a.id_users_provider = prov.id
      LEFT JOIN ea_users cust ON a.id_users_customer = cust.id
      WHERE a.start_datetime >= ? AND a.start_datetime <= ?
        AND prov.id_roles = 2
      ORDER BY a.start_datetime ASC
    `;

        const [rows] = await connection.execute(sql, [startOfDay, endOfDay]);
        connection.release();

        // 2. Extraer IDs
        const citas = rows.map(cita => {
            let casoId = null;
            if (cita.notas_estructuradas) {
                try {
                    const structured = JSON.parse(cita.notas_estructuradas);
                    if (structured.caso_id) casoId = structured.caso_id;
                } catch (e) { }
            }
            return { ...cita, caso_id: casoId };
        });

        const casoIds = citas.map(c => c.caso_id).filter(id => id !== null);
        let casosMap = new Map();

        // 3. Supabase (CORREGIDO: Pedimos 'telefono')
        if (casoIds.length > 0) {
            const { data: casosData, error } = await supabaseAdmin
                .from('casos')
                .select(`
          id, tipo_servicio,
          cliente:clientes (nombre_completo, telefono, direccion_principal, google_maps_link)
        `)
                .in('id', casoIds);

            if (!error && casosData) {
                casosMap = new Map(casosData.map(c => [c.id, c]));
            } else if (error) {
                console.error('Error Supabase:', error);
            }
        }

        // 4. Fusionar
        const agenda = citas.map(cita => {
            const caso = casosMap.get(cita.caso_id);

            let titulo = cita.is_unavailable ? 'BLOQUEO / SIN DATOS' : 'OCUPADO';
            let nombreCliente = '';
            let celular = '';
            let direccion = '';
            let mapsLink = '';
            let tipoServicio = '';

            // Prioridad 2: EasyAppointments
            if (cita.ea_cliente_nombre) {
                nombreCliente = `${cita.ea_cliente_nombre} ${cita.ea_cliente_apellido || ''}`.trim();
                celular = cita.ea_cliente_celular || cita.ea_cliente_telefono || '';
                direccion = cita.ea_cliente_direccion || '';
                titulo = nombreCliente;
            }

            // Prioridad 1: Supabase
            if (caso && caso.cliente) {
                nombreCliente = caso.cliente.nombre_completo || nombreCliente;
                // CORRECCIÓN: Asignamos 'telefono' de Supabase a nuestra variable 'celular'
                celular = caso.cliente.telefono || celular;
                direccion = caso.cliente.direccion_principal || direccion;
                mapsLink = caso.cliente.google_maps_link || '';
                titulo = nombreCliente;
                tipoServicio = caso.tipo_servicio;
            }

            if (cita.is_unavailable && !nombreCliente) {
                titulo = 'BLOQUEO / DESCANSO';
            }

            return {
                id: cita.id,
                resourceId: cita.id_users_provider,
                title: titulo,
                start: dayjs(cita.start_datetime).format('YYYY-MM-DD HH:mm:ss'),
                end: dayjs(cita.end_datetime).format('YYYY-MM-DD HH:mm:ss'),
                type: cita.is_unavailable ? 'blocked' : 'appointment',
                tecnico: cita.tecnico_nombre,
                details: {
                    cliente: nombreCliente,
                    celular: celular, // Aquí va el dato corregido
                    direccion: direccion,
                    mapsLink: mapsLink,
                    tipoServicio: tipoServicio,
                    notas: cita.notes || ''
                }
            };
        });

        res.json(agenda);
    } catch (error) {
        console.error('Error agenda:', error);
        res.status(500).json({ error: 'Error interno' });
    }
};

// A) Helper para Geocodificar en el servidor (Seguridad y Precisión)
const geocodeAddress = async (address) => {
    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Asegúrate de tener esto en tu .env
    if (!address || !GOOGLE_API_KEY) return null;

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:MX&key=${GOOGLE_API_KEY}`;
        const response = await axios.get(url);

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const result = response.data.results[0];
            return {
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                formatted_address: result.formatted_address
            };
        }
    } catch (error) {
        console.error("Error Geocoding Server-Side:", error);
    }
    return null;
};

// B) Helper para Link de Google Maps
const generateNavigationLink = (lat, lng, query) => {
    if (lat && lng) return `http://googleusercontent.com/maps.google.com/maps?q=${lat},${lng}`;
    return `http://googleusercontent.com/maps.google.com/maps?q=${encodeURIComponent(query)}`;
};

// C) FUNCIÓN PRINCIPAL: Actualizar Ubicación
export const actualizarUbicacionCita = async (req, res) => {
    const { id } = req.params; // ID de la cita
    const { direccion } = req.body; // Dirección en texto que mandó el Frontend

    if (!id || !direccion) return res.status(400).json({ error: 'Faltan datos' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        console.log(`📍 Procesando actualización para Cita EA ID: ${id}`);

        // 1. Buscamos la cita para ver si tiene un caso_id de Supabase
        const [rows] = await connection.execute(
            `SELECT notas_estructuradas FROM ea_appointments WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ error: 'Cita no encontrada' });
        }

        // 2. Geocodificamos la dirección "bonita" que nos mandó el Frontend
        const geoData = await geocodeAddress(direccion);
        const direccionFinal = geoData ? geoData.formatted_address : direccion;
        const mapLink = geoData
            ? generateNavigationLink(geoData.lat, geoData.lng, direccionFinal)
            : generateNavigationLink(null, null, direccionFinal);

        // 3. Identificamos si hay que actualizar en Supabase
        const notas = rows[0].notas_estructuradas ? JSON.parse(rows[0].notas_estructuradas) : {};

        if (notas.caso_id) {
            console.log(`🔄 Actualizando Caso #${notas.caso_id} en Supabase...`);

            // a) Obtener cliente ligado al caso
            const { data: casoData } = await supabaseAdmin
                .from('casos')
                .select('cliente_id')
                .eq('id', notas.caso_id)
                .single();

            if (casoData && casoData.cliente_id) {
                // b) Actualizar Cliente en Supabase
                const { error: updateError } = await supabaseAdmin
                    .from('clientes')
                    .update({
                        direccion_principal: direccionFinal,
                        google_maps_link: mapLink
                    })
                    .eq('id', casoData.cliente_id);

                if (updateError) throw new Error('Supabase Error: ' + updateError.message);
                console.log("✅ Cliente Supabase actualizado.");
            }
        }

        // 4. (Opcional) Si quieres guardar el link en las notas internas de EA también, podrías hacerlo aquí.
        // Por ahora, con actualizar Supabase basta para que el Frontend lo lea al recargar.

        await connection.commit();

        // Respondemos al Frontend con éxito
        res.json({
            success: true,
            message: 'Ubicación actualizada correctamente',
            direccion: direccionFinal,
            mapLink
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error actualizando ubicación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        if (connection) connection.release();
    }
};

// D) FUNCIÓN NUEVA: Borrado Total (Hard Delete)
export const borrarCitaGlobal = async (req, res) => {
    const { id } = req.params; // ID de la cita en Easy!Appointments

    if (!id) return res.status(400).json({ error: 'Falta ID de la cita' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        console.log(`🗑️ Iniciando borrado total para Cita EA ID: ${id}`);

        // 1. Obtener información de la cita para buscar vínculos con Supabase
        const [rows] = await connection.execute(
            `SELECT notas_estructuradas FROM ea_appointments WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            // Si no existe en MariaDB, no podemos hacer mucho, terminamos.
            connection.release();
            return res.status(404).json({ error: 'Cita no encontrada en Easy!Appointments' });
        }

        // 2. Analizar JSON para ver si hay ID de Caso Supabase
        const notas = rows[0].notas_estructuradas ? JSON.parse(rows[0].notas_estructuradas) : {};
        const casoId = notas.caso_id;

        // 3. Borrar en Supabase (Si existe vínculo)
        if (casoId) {
            console.log(`🔥 Borrando Caso #${casoId} en Supabase...`);

            // Borramos el caso. Nota: Esto asume que tienes "On Delete Cascade" en tus tablas 
            // de revisiones/fotos. Si no, habría que borrar esas tablas primero manualmente.
            const { error: errorSupabase } = await supabaseAdmin
                .from('casos')
                .delete()
                .eq('id', casoId);

            if (errorSupabase) {
                throw new Error('Error borrando en Supabase: ' + errorSupabase.message);
            }
        } else {
            console.log('ℹ️ Cita sin vínculo a Supabase (solo agenda local).');
        }

        // 4. Borrar en MariaDB (Easy!Appointments)
        console.log(`🔥 Borrando cita física en MariaDB...`);
        await connection.execute(
            `DELETE FROM ea_appointments WHERE id = ?`,
            [id]
        );

        await connection.commit();
        console.log('✅ Borrado total exitoso.');

        res.json({ success: true, message: 'Cita y Caso eliminados correctamente.' });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error en borrado total:', error);
        res.status(500).json({ error: 'Error interno al intentar borrar la cita.' });
    } finally {
        if (connection) connection.release();
    }
};