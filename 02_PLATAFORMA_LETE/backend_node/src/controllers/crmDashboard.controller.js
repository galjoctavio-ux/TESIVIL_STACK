import pool from '../services/eaDatabase.js';
import { supabaseAdmin as supabase } from '../services/supabaseClient.js';

/**
 * CONTROLADOR MAESTRO DEL DASHBOARD CRM V2 (CORREGIDO Y OPTIMIZADO)
 */
export const getCrmDashboardV2 = async (req, res) => {
    try {
        console.log("🔄 Iniciando sincronización de Dashboard CRM V2...");

        // 1. OBTENER DATOS DE SUPABASE (Clientes, Casos, y Nombre de Técnico)
        const { data: clientesSupa, error: errorSupa } = await supabase
            .from('clientes')
            .select(`
                *,
                casos (
                    id, 
                    status, 
                    descripcion_problema, 
                    monto_cobrado, 
                    created_at,
                    // SOLUCIÓN A PUNTO 7: Traer el nombre del técnico vía el JOIN implícito de Supabase
                    tecnico_id,
                    profiles!casos_tecnico_id_fkey (nombre, rol) 
                )
            `)
            .order('last_interaction', { ascending: false })
            .limit(100);

        if (errorSupa) throw new Error(`Error Supabase: ${errorSupa.message}`);

        // 2. OBTENER DATOS DE MARIADB (Agenda) - Se mantienen 7 días para eficiencia en un CRM activo
        const queryMaria = `
            SELECT 
                a.id AS cita_id,
                a.start_datetime,
                a.end_datetime,
                a.is_unavailable,
                a.notas_estructuradas, 
                c.mobile_number AS cliente_telefono,
                c.first_name AS cliente_nombre,
                c.last_name AS cliente_apellido,
                p.first_name AS tecnico_nombre,
                p.last_name AS tecnico_apellido,
                p.id AS tecnico_id_ea
            FROM ea_appointments a
            LEFT JOIN ea_users c ON a.id_users_customer = c.id
            LEFT JOIN ea_users p ON a.id_users_provider = p.id
            WHERE a.start_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY) OR a.start_datetime >= NOW()
        `; // Se ajusta la lógica de la fecha para incluir todas las futuras.

        const [citasMaria] = await pool.execute(queryMaria);

        // 3. EL GRAN CRUCE (THE MERGE)
        const datosUnificados = clientesSupa.map(cliente => {

            // A. Normalización (PUNTO 2 y 6)
            // La única forma segura de match es usando los últimos 10 dígitos. 
            // Si esto falla, los números están mal guardados en alguna de las dos bases.
            const telefonoCliente = (cliente.telefono || '').replace(/\D/g, '').slice(-10);

            // B. Buscar coincidencia en Agenda
            const citaEncontrada = citasMaria.find(cita => {
                const telefonoCita = (cita.cliente_telefono || '').replace(/\D/g, '').slice(-10);
                return telefonoCliente && telefonoCita.length >= 7 && telefonoCita === telefonoCliente;
            });

            // C. Encontrar Técnico Asignado a un Caso reciente (PUNTO 7)
            const casosConTecnicos = cliente.casos?.filter(c => c.profiles?.[0]?.nombre);
            const tecnicoCaso = casosConTecnicos?.length > 0
                ? `${casosConTecnicos[casosConTecnicos.length - 1].profiles[0].nombre}`
                : null;

            // D. Calcular Integridad (PUNTO 4 y 5)
            let integridad = 'OK';
            let mensajeIntegridad = 'Lead OK';
            let accionSugerida = 'VER_DETALLES';

            const tieneIntencionCita = cliente.crm_intent === 'APPOINTMENT' || cliente.crm_intent === 'QUOTE_FOLLOWUP';
            const tieneCitaReal = !!citaEncontrada;

            if (tieneIntencionCita && !tieneCitaReal) {
                integridad = 'ERROR_GHOST';
                mensajeIntegridad = '🚨 Cita Fantasma';
                accionSugerida = 'AGENDAR_AHORA';
            } else if (!tieneIntencionCita && tieneCitaReal) {
                integridad = 'MANUAL';
                mensajeIntegridad = '⚠️ Agendado Manual';
            } else if (tieneIntencionCita && tieneCitaReal) {
                integridad = 'OK';
                mensajeIntegridad = 'Sincronizado';
            }
            // Los casos sin intención ni cita real se quedan en 'Lead OK'

            // E. Calcular Finanzas (Se mantienen los cálculos basados en tu Schema)
            const saldoPendiente = parseFloat(cliente.saldo_pendiente || 0);
            const totalCobrado = cliente.casos?.reduce((sum, caso) => sum + (parseFloat(caso.monto_cobrado) || 0), 0) || 0;
            const totalCotizadoEstimado = totalCobrado + saldoPendiente;

            return {
                id: cliente.id,
                nombre_completo: cliente.nombre_completo || 'Sin Nombre',
                telefono: cliente.telefono,
                crm_intent: cliente.crm_intent,
                ai_summary: cliente.ai_summary,

                cita_real: tieneCitaReal ? {
                    fecha: citaEncontrada.start_datetime,
                    tecnico: `${citaEncontrada.tecnico_nombre} ${citaEncontrada.tecnico_apellido}`,
                    id_cita: citaEncontrada.cita_id
                } : null,

                tecnico_caso_supa: tecnicoCaso, // Nombre del técnico del caso (Supabase)

                status_integridad: integridad,
                mensaje_integridad: mensajeIntegridad,
                accion_sugerida: accionSugerida,

                finanzas: {
                    total_cotizado: totalCotizadoEstimado,
                    total_pagado: totalCobrado,
                    saldo_pendiente: saldoPendiente,
                    status_pago: saldoPendiente > 0 ? 'DEUDA' : 'AL_CORRIENTE'
                },

                casos: cliente.casos
            };
        });

        res.json({ success: true, total: datosUnificados.length, data: datosUnificados });

    } catch (error) {
        console.error("❌ Error CRITICO en CrmDashboardV2:", error);
        res.status(500).json({ error: "Error interno al cruzar datos. Consulte logs para detalles." });
    }
};