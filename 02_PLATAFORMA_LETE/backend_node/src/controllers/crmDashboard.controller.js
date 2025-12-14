import pool from '../services/eaDatabase.js';
import { supabaseAdmin as supabase } from '../services/supabaseClient.js';

/**
 * CONTROLADOR MAESTRO DEL DASHBOARD CRM V2 (CORREGIDO SEGÚN SCHEMA)
 */
export const getCrmDashboardV2 = async (req, res) => {
    try {
        console.log("🔄 Iniciando sincronización de Dashboard CRM V2...");

        // 1. OBTENER DATOS DE SUPABASE (Validado con Schema)
        const { data: clientesSupa, error: errorSupa } = await supabase
            .from('clientes')
            .select(`
                *,
                casos (
                    id, 
                    status, 
                    descripcion_problema, 
                    monto_cobrado, 
                    tecnico_id, 
                    created_at
                )
            `)
            .order('last_interaction', { ascending: false })
            .limit(100);

        if (errorSupa) throw new Error(`Error Supabase: ${errorSupa.message}`);

        // 2. OBTENER DATOS DE MARIADB (Agenda)
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
            WHERE a.start_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;

        const [citasMaria] = await pool.execute(queryMaria);

        // 3. EL GRAN CRUCE (THE MERGE)
        const datosUnificados = clientesSupa.map(cliente => {

            // A. Normalización
            const telefonoCliente = (cliente.telefono || '').replace(/\D/g, '').slice(-10);

            // B. Buscar coincidencia en Agenda
            const citaEncontrada = citasMaria.find(cita => {
                const telefonoCita = (cita.cliente_telefono || '').replace(/\D/g, '').slice(-10);
                return telefonoCliente && telefonoCita === telefonoCliente;
            });

            // C. Calcular Integridad
            let integridad = 'OK';
            let mensajeIntegridad = 'Sincronizado';
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
            }

            // D. Calcular Finanzas (Adaptado a tu Schema)
            // Usamos 'saldo_pendiente' directo de la tabla clientes
            const saldoPendiente = parseFloat(cliente.saldo_pendiente || 0);

            // Estimamos lo cobrado sumando 'monto_cobrado' de los casos históricos
            const totalCobrado = cliente.casos?.reduce((sum, caso) => sum + (parseFloat(caso.monto_cobrado) || 0), 0) || 0;

            // Calculamos un "Total Cotizado Aproximado" para la barra de progreso
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

                status_integridad: integridad,
                mensaje_integridad: mensajeIntegridad,
                accion_sugerida: accionSugerida,

                finanzas: {
                    total_cotizado: totalCotizadoEstimado,
                    total_pagado: totalCobrado,
                    saldo_pendiente: saldoPendiente,
                    status_pago: saldoPendiente > 0 ? 'DEUDA' : 'AL_CORRIENTE'
                },

                // Pasamos los casos para mostrar detalles si se requiere
                casos: cliente.casos
            };
        });

        // 4. RESPUESTA
        res.json({
            success: true,
            total: datosUnificados.length,
            data: datosUnificados
        });

    } catch (error) {
        console.error("❌ Error CRITICO en CrmDashboardV2:", error);
        res.status(500).json({ error: error.message });
    }
};