import pool from '../services/eaDatabase.js';
import { supabaseAdmin as supabase } from '../services/supabaseClient.js';

/**
 * CONTROLADOR MAESTRO DEL DASHBOARD CRM V2
 * Objetivo: Auditoría Visual y Cruce de Verdad (Lectura Pura)
 * Lógica: Cruza Supabase (Negocio) con MariaDB (Agenda) usando JSON ID o Teléfono.
 */
export const getCrmDashboardV2 = async (req, res) => {
    try {
        console.log("🔄 Ejecutando Auditoría CRM V2...");

        // 1. OBTENER DATOS DE SUPABASE (La Verdad del Negocio)
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
                    tecnico_id,
                    profiles!casos_tecnico_id_fkey (
                        nombre,
                        rol
                    )
                )
            `)
            .order('last_interaction', { ascending: false })
            .limit(10000);

        if (errorSupa) throw new Error(`Error Supabase: ${errorSupa.message}`);

        // 2. OBTENER DATOS DE MARIADB (La Verdad de la Agenda)
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
            WHERE a.start_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `;

        const [citasMaria] = await pool.execute(queryMaria);

        // 3. EL GRAN CRUCE (THE MERGE)
        const datosUnificados = clientesSupa.map(cliente => {

            // Preparar IDs de casos para búsqueda rápida en el JSON de la cita
            const clienteCaseIds = cliente.casos?.map(c => String(c.id)) || [];
            // Normalizar teléfono del cliente (solo dígitos, últimos 10)
            const telefonoCliente = (cliente.telefono || '').replace(/\D/g, '').slice(-10);

            // --- LÓGICA DE MATCH REFINADA ---
            let matchPorJson = false;
            let matchPorTelefono = false;
            let citaEncontradaData = null;

            // Buscamos en todas las citas para ver cuál coincide mejor
            const citaMatch = citasMaria.find(cita => {
                let isJsonMatch = false;
                let isPhoneMatch = false;

                // A. Intentar Match por JSON (Prioridad Absoluta según Regla de Negocio)
                if (cita.notas_estructuradas && clienteCaseIds.length > 0) {
                    try {
                        const notas = JSON.parse(cita.notas_estructuradas);
                        if (notas.caso_id && clienteCaseIds.includes(String(notas.caso_id))) {
                            isJsonMatch = true;
                        }
                    } catch (e) {
                        // JSON inválido, ignorar
                    }
                }

                // B. Intentar Match por Teléfono (Secundario)
                const telefonoCita = (cita.cliente_telefono || '').replace(/\D/g, '').slice(-10);
                if (telefonoCliente && telefonoCliente.length === 10 && telefonoCita === telefonoCliente) {
                    isPhoneMatch = true;
                }

                // Guardamos el tipo de match encontrado
                if (isJsonMatch) {
                    matchPorJson = true;
                    return true; // Encontramos el match ideal, dejamos de buscar
                }
                if (isPhoneMatch) {
                    matchPorTelefono = true;
                    // No retornamos true inmediatamente si solo es teléfono, 
                    // idealmente quisiéramos seguir buscando un match por JSON si existe,
                    // pero para simplificar, si encontramos match por teléfono lo guardamos temporalmente.
                    // (Nota: find devuelve el primero que cumple true. Si queremos prioridad JSON, 
                    // deberíamos buscar primero JSON y luego Teléfono en dos pasadas o ordenar, 
                    // pero dado el volumen, asumiremos que si hay JSON match lo encontraremos).
                    // Para asegurar prioridad JSON, haremos el return solo si es JSON, o al final si es Tel.
                    // Pero como .find se detiene al primer true, ajustaremos la estrategia:
                    return false;
                }
                return false;
            });

            // Re-estrategia de búsqueda para asegurar prioridad JSON sobre Teléfono
            // 1. Buscar match estricto por JSON
            citaEncontradaData = citasMaria.find(cita => {
                if (!cita.notas_estructuradas || clienteCaseIds.length === 0) return false;
                try {
                    const notas = JSON.parse(cita.notas_estructuradas);
                    return notas.caso_id && clienteCaseIds.includes(String(notas.caso_id));
                } catch (e) { return false; }
            });

            if (citaEncontradaData) {
                matchPorJson = true;
            } else {
                // 2. Si no hay JSON match, buscar por Teléfono
                citaEncontradaData = citasMaria.find(cita => {
                    const telefonoCita = (cita.cliente_telefono || '').replace(/\D/g, '').slice(-10);
                    return telefonoCliente && telefonoCliente.length === 10 && telefonoCita === telefonoCliente;
                });
                if (citaEncontradaData) matchPorTelefono = true;
            }


            // --- LÓGICA DE DIAGNÓSTICO (SEMÁFORO) ---
            let integridad = 'OK';
            let mensajeIntegridad = 'Lead OK';
            let accionSugerida = 'VER_DETALLES';

            // CORRECCIÓN 1: Intención solo es APPOINTMENT
            const tieneIntencionCita = cliente.crm_intent === 'APPOINTMENT';

            // CORRECCIÓN 2: Lógica estricta de Fantasmas
            if (tieneIntencionCita) {
                if (matchPorJson) {
                    // Ideal: Intención Appointment y Cita ligada por Caso ID
                    integridad = 'OK';
                    mensajeIntegridad = 'Sincronizado';
                    accionSugerida = 'VER_DETALLES';
                } else {
                    // Si es APPOINTMENT y no tiene match por JSON -> FANTASMA
                    // (Incluso si tuviera match por teléfono, al no estar ligada el caso, es un error de integridad para este flujo)
                    integridad = 'ERROR_GHOST';
                    mensajeIntegridad = matchPorTelefono ? '🚨 Cita Mal Ligada (Sin Caso)' : '🚨 Cita Fantasma';
                    accionSugerida = 'REVISAR_MANUAL';
                }
            } else {
                // Si NO es APPOINTMENT (ej. Quote Followup, Lead, etc.)
                if (citaEncontradaData) {
                    // Tiene cita pero la IA no marca Appointment -> Manual
                    integridad = 'MANUAL';
                    mensajeIntegridad = '⚠️ Agendado Manual';
                    accionSugerida = 'VER_DETALLES';
                } else if (cliente.crm_status === 'CLIENTE') {
                    mensajeIntegridad = 'Cliente Inactivo';
                }
            }

            // --- DETERMINAR NOMBRE DEL TÉCNICO ---
            let tecnicoNombreFinal = 'Pendiente';

            if (citaEncontradaData) {
                tecnicoNombreFinal = `${citaEncontradaData.tecnico_nombre} ${citaEncontradaData.tecnico_apellido}`;
            } else if (cliente.casos?.length > 0) {
                const ultimoCaso = cliente.casos[0];
                if (ultimoCaso.profiles) {
                    tecnicoNombreFinal = Array.isArray(ultimoCaso.profiles)
                        ? ultimoCaso.profiles[0]?.nombre
                        : ultimoCaso.profiles.nombre;
                }
            }

            // --- CÁLCULO DE FINANZAS ---
            const saldoPendiente = parseFloat(cliente.saldo_pendiente || 0);
            const totalCobrado = cliente.casos?.reduce((sum, caso) => sum + (parseFloat(caso.monto_cobrado) || 0), 0) || 0;

            return {
                id: cliente.id,
                nombre_completo: cliente.nombre_completo,
                telefono: cliente.telefono,
                crm_intent: cliente.crm_intent,
                ai_summary: cliente.ai_summary,
                last_interaction: cliente.last_interaction,

                cita_real: citaEncontradaData ? {
                    fecha: citaEncontradaData.start_datetime,
                    tecnico: `${citaEncontradaData.tecnico_nombre} ${citaEncontradaData.tecnico_apellido}`,
                    id_cita: citaEncontradaData.cita_id,
                    match_type: matchPorJson ? 'JSON_CASO' : 'TELEFONO' // Útil para debug visual si lo necesitas
                } : null,

                tecnico_asignado: tecnicoNombreFinal || 'Sin Asignar',

                status_integridad: integridad,
                mensaje_integridad: mensajeIntegridad,
                accion_sugerida: accionSugerida,

                finanzas: {
                    total_cotizado: totalCobrado + saldoPendiente,
                    total_pagado: totalCobrado,
                    saldo_pendiente: saldoPendiente,
                    status_pago: saldoPendiente > 0 ? 'DEUDA' : 'AL_CORRIENTE'
                },

                casos: cliente.casos
            };
        });

        res.json({ success: true, total: datosUnificados.length, data: datosUnificados });

    } catch (error) {
        console.error("❌ Error CRITICO en Dashboard V2:", error);
        res.status(500).json({ error: error.message });
    }
};