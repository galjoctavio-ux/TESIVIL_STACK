import pool from '../services/eaDatabase.js';
import { supabase } from '../services/supabaseClient.js';

/**
 * CONTROLADOR MAESTRO DEL DASHBOARD CRM
 * Objetivo: Cruzar la verdad de la IA (Supabase) con la verdad Operativa (MariaDB/EasyAppointments)
 */
export const getCrmDashboardV2 = async (req, res) => {
    try {
        console.log("🔄 Iniciando sincronización de Dashboard CRM V2...");

        // 1. OBTENER DATOS DE SUPABASE (La visión del negocio y la IA)
        // Traemos clientes, sus casos recientes y transacciones financieras
        const { data: clientesSupa, error: errorSupa } = await supabase
            .from('clientes')
            .select(`
                *,
                casos (
                    id, status, descripcion, costo_total, pago_realizado, tecnico_id, created_at
                ),
                billetera_transacciones (
                    monto, tipo, estado
                )
            `)
            .order('last_interaction', { ascending: false })
            .limit(100); // Limitamos para pruebas iniciales, luego podemos paginar

        if (errorSupa) throw new Error(`Error Supabase: ${errorSupa.message}`);

        // 2. OBTENER DATOS DE MARIADB (La realidad operativa / Agenda)
        // Traemos citas FUTURAS y RECIENTES (últimos 7 días) para ver si se cumplieron
        // Hacemos JOIN con ea_users para saber quién es el cliente y quién el técnico
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

            // A. Normalización de Teléfono para el Match
            // Quitamos caracteres no numéricos y tomamos los últimos 10 dígitos
            const telefonoCliente = (cliente.telefono || '').replace(/\D/g, '').slice(-10);

            // B. Buscar coincidencia en la Agenda (MariaDB)
            // Estrategia: Coincidencia por teléfono O coincidencia por ID en notas_estructuradas (si existe)
            const citaEncontrada = citasMaria.find(cita => {
                const telefonoCita = (cita.cliente_telefono || '').replace(/\D/g, '').slice(-10);
                const matchTelefono = telefonoCliente && telefonoCita === telefonoCliente;

                // Futuro: Aquí podríamos buscar también por ID si guardas {"supabase_id": "..."} en notas_estructuradas
                return matchTelefono;
            });

            // C. Calcular Integridad (Semáforo de Verdad)
            let integridad = 'OK';
            let mensajeIntegridad = 'Sincronizado';
            let accionSugerida = 'VER_DETALLES';

            const tieneIntencionCita = cliente.crm_intent === 'APPOINTMENT' || cliente.crm_intent === 'QUOTE_FOLLOWUP';
            const tieneCitaReal = !!citaEncontrada;

            if (tieneIntencionCita && !tieneCitaReal) {
                integridad = 'ERROR_GHOST'; // IA dice cita, Agenda vacía
                mensajeIntegridad = '🚨 Cita Fantasma';
                accionSugerida = 'AGENDAR_AHORA';
            } else if (!tieneIntencionCita && tieneCitaReal) {
                integridad = 'MANUAL'; // Agenda tiene cita, IA no sabía
                mensajeIntegridad = '⚠️ Agendado Manual';
            }

            // D. Calcular Finanzas del Cliente
            const totalCotizado = cliente.casos?.reduce((sum, caso) => sum + (caso.costo_total || 0), 0) || 0;
            // Aquí sumamos pagos reales de la tabla de transacciones o de la columna pago_realizado
            const totalPagado = cliente.casos?.reduce((sum, caso) => sum + (caso.pago_realizado || 0), 0) || 0;
            const saldoPendiente = totalCotizado - totalPagado;

            return {
                // Datos base de Supabase
                id: cliente.id,
                nombre_completo: cliente.nombre_completo || 'Sin Nombre',
                telefono: cliente.telefono,
                crm_intent: cliente.crm_intent,
                ai_summary: cliente.ai_summary,

                // Datos enriquecidos de MariaDB
                cita_real: tieneCitaReal ? {
                    fecha: citaEncontrada.start_datetime,
                    tecnico: `${citaEncontrada.tecnico_nombre} ${citaEncontrada.tecnico_apellido}`,
                    id_cita: citaEncontrada.cita_id
                } : null,

                // Diagnóstico del sistema
                status_integridad: integridad,
                mensaje_integridad: mensajeIntegridad,
                accion_sugerida: accionSugerida,

                // Finanzas Calculadas
                finanzas: {
                    total_cotizado: totalCotizado,
                    total_pagado: totalPagado,
                    saldo_pendiente: saldoPendiente > 0 ? saldoPendiente : 0,
                    status_pago: saldoPendiente > 0 ? 'DEUDA' : 'AL_CORRIENTE'
                }
            };
        });

        // 4. RESPUESTA AL FRONTEND
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