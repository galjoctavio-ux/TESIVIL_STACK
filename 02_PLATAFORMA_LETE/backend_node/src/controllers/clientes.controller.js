import { supabaseAdmin } from '../services/supabaseClient.js';
import { checkMariaDbStatus, checkPastAppointments } from '../services/eaDatabase.js';

// GET /api/clientes/buscar?telefono=33123...
export const buscarCliente = async (req, res) => {
    const { telefono } = req.query;

    if (!telefono || telefono.length < 4) {
        return res.status(400).json({ error: 'Proporciona al menos 4 dígitos' });
    }

    const cleanPhone = telefono.replace(/\D/g, '');

    try {
        const { data, error } = await supabaseAdmin
            .from('clientes')
            .select('*')
            .ilike('telefono', `%${cleanPhone}%`)
            .limit(5);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/clientes/:id/historial
export const getHistorialCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabaseAdmin
            .from('casos')
            .select(`
        id, fecha_creacion, status, tipo_servicio, monto_cobrado,
        tecnico:profiles(nombre)
      `)
            .eq('cliente_id', id)
            .order('fecha_creacion', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- EL CEREBRO DE LA FUENTE DE LA VERDAD ---
// GET /api/clientes/admin-dashboard
export const getAdminDashboard = async (req, res) => {
    try {
        // 1. Obtener la vista base de Supabase (asumimos que 'admin_crm_dashboard' existe y es la base)
        const { data: clientes, error } = await supabaseAdmin
            .from('admin_crm_dashboard')
            .select('*');

        if (error) throw error;

        // 2. ENRIQUECIMIENTO EN TIEMPO REAL (CRUCE DE 3 BASES DE DATOS)
        // Usamos Promise.all para procesar los clientes en paralelo sin detener el loop
        const datosEnriquecidos = await Promise.all(clientes.map(async (cliente) => {

            // --- A. LÓGICA MARIADB (EASY!APPOINTMENTS) ---
            let mariadbInfo = { exists: false, has_past_appointment: false };
            if (cliente.telefono) {
                // Buscamos si existe en la agenda
                const check = await checkMariaDbStatus(cliente.telefono);
                if (check.exists) {
                    // Si existe, verificamos si tiene citas pasadas (cliente recurrente)
                    const hasPast = await checkPastAppointments(check.id);
                    mariadbInfo = { exists: true, has_past_appointment: hasPast };
                }
            }

            // --- B. LÓGICA EVOLUTION API (WHATSAPP) ---
            // Regla práctica: Si tiene whatsapp_id, está sincronizado en Evolution
            const evolutionSynced = !!cliente.whatsapp_id;

            // --- C. LÓGICA "DEBEMOS COTIZACIÓN" ---
            // Buscamos en la tabla 'casos' si hay algo pendiente marcado como 'requiere_cotizacion'
            let debeCotizacion = false;
            // Nota: La vista suele llamar al ID 'cliente_id' o 'id'. Verificamos ambos.
            const idBusqueda = cliente.cliente_id || cliente.id;

            if (idBusqueda) {
                const { data: casosPendientes } = await supabaseAdmin
                    .from('casos')
                    .select('id')
                    .eq('cliente_id', idBusqueda)
                    .eq('requiere_cotizacion', true)
                    .neq('status', 'cerrado') // Solo si el caso no está cerrado
                    .limit(1);

                if (casosPendientes && casosPendientes.length > 0) {
                    debeCotizacion = true;
                }
            }

            // --- D. LÓGICA DE ALERTAS INTELIGENTES ---
            // Regla: Si IA o el sistema dice que es "CITA" pero NO está en MariaDB -> ALERTA
            // (Asumimos que crm_intent='CITA' es la bandera de la IA)
            const esIntencionCita = cliente.crm_intent === 'CITA' || cliente.prioridad_visual === 'CITA';
            const alertaCitaNoAgendada = esIntencionCita && !mariadbInfo.exists;

            // Retornamos el cliente original + las nuevas banderas
            return {
                ...cliente,
                // Banderas de Sincronización
                sync_mariadb: mariadbInfo.exists,
                sync_evolution: evolutionSynced,

                // Estados Visuales
                cita_realizada: mariadbInfo.has_past_appointment,
                alerta_cita_desincronizada: alertaCitaNoAgendada, // Nuevo warning visual
                debe_cotizacion: debeCotizacion,

                // Datos extra de seguridad (por si la vista no los trae todos)
                direccion_real: cliente.direccion_principal || '',
                mapa_link: cliente.google_maps_link || '',
                calificacion_semaforo: cliente.calificacion || 'AMABLE'
            };
        }));

        res.json(datosEnriquecidos);
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ error: error.message });
    }
};

// PATCH /api/clientes/:id/force-analyze
export const forceAnalyzeClient = async (req, res) => {
    const { id } = req.params;
    try {
        await supabaseAdmin
            .from('clientes')
            .update({ last_interaction: new Date() })
            .eq('id', id);

        res.json({ message: 'Cliente marcado para análisis inmediato.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/clientes/:id/chat
export const getChatCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabaseAdmin
            .from('mensajes_whatsapp')
            .select('*')
            .eq('cliente_id', id)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};