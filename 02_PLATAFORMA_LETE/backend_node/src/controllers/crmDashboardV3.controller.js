import pool from '../services/eaDatabase.js';
import { supabaseAdmin as supabase } from '../services/supabaseClient.js';

/**
 * CONTROLADOR DASHBOARD V3.1 (ORACLE EDITION)
 * Objetivo: Predicción exacta de textos, tiempos y prioridades.
 */

// --- 1. SIMULADOR DE SCRIPTS (Copiado de cronReminders.ts para exactitud) ---
const generarDraftMensaje = (cliente, intent) => {
    const nombre = cliente.nombre_completo || '';
    
    if (intent === 'NO_REPLY') {
        return `Hola ${nombre}, buen día. 👋 Notamos que quedó pendiente tu reporte. ¿Aún tienes problemas con tu instalación o prefieres que cerremos tu expediente por ahora?`;
    } 
    if (intent === 'QUOTE_FOLLOWUP') {
        return `Hola ${nombre}, buen día. 👋 Solo para confirmar si pudiste revisar la propuesta que te enviamos. ¿Te gustaría que procedamos?`;
    } 
    if (intent === 'FUTURE_CONTACT') {
        return `Hola! ⚡ Como acordamos, te contacto para retomar el tema de tu revisión eléctrica. ¿Te gustaría que agendemos una visita para esta semana?`;
    }
    // Lógica de Citas
    if (intent === 'REMINDER_TOMORROW') {
        return `Hola ${nombre}! 👋 Te recordamos que el día de *mañana* tenemos agendada tu revisión técnica.`;
    }
    if (intent === 'REMINDER_TODAY') {
        // Asumimos hora actual para el simulador, aunque el cron usa la real
        return `Buen día! ☀️ Te recordamos que tu visita es el día de *hoy*.`;
    }
    return null;
};

// --- 2. CALCULADORA DE PRIORIDAD ("DE QUIÉN ES EL BALÓN") ---
const analizarSituacion = (cliente, citaReal) => {
    // A. ¿Hay mensajes sin leer? -> CANCHA NUESTRA (URGENTE)
    if (cliente.unread_count > 0) {
        return { estado: 'URGENTE_REPLY', label: '🔥 Cliente Esperando', color: 'red', peso: 100 };
    }

    // B. ¿Es una Cita Fantasma? -> CANCHA NUESTRA (ERROR)
    if (cliente.crm_intent === 'APPOINTMENT' && !citaReal) {
        return { estado: 'ERROR_GHOST', label: '👻 Fantasma (Agendar)', color: 'red', peso: 90 };
    }

    // C. ¿Hay cita mañana/hoy? -> SISTEMA (AUTOMÁTICO)
    const nextAction = getCronStatus(cliente);
    if (nextAction.tipo === 'AUTO_REMINDER') {
        return { ...nextAction, peso: 80 }; // Prioridad alta por ser cita
    }

    // D. ¿Hay seguimiento programado vencido? -> SISTEMA (SALE YA)
    if (nextAction.tipo === 'AUTO_MSG') {
        return { ...nextAction, peso: 70 };
    }

    // E. ¿Hay seguimiento futuro? -> CANCHA DE ELLOS (ESPERANDO TIEMPO)
    if (nextAction.tipo === 'AUTO_MSG_FUTURE') {
        return { ...nextAction, peso: 20 };
    }

    // F. ¿Esperando respuesta de ellos? -> CANCHA DE ELLOS
    if (cliente.crm_intent === 'AWAITING_REPLY') {
        return { estado: 'WAITING', label: '⏳ Esperando Cliente', color: 'gray', peso: 10 };
    }

    return { estado: 'LIMBO', label: '💤 Inactivo', color: 'gray', peso: 0 };
};

// --- 3. LÓGICA DE CRON (Mejorada con hora exacta) ---
const getCronStatus = (cliente) => {
    if (!cliente.appointment_date && !cliente.next_follow_up_date) {
        return { tipo: 'NADA', label: '-', color: 'gray', fecha: null };
    }

    const now = new Date();
    const mxNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    
    // CITAS
    if (cliente.appointment_date && ['PENDIENTE', 'REMINDED_TOMORROW'].includes(cliente.appointment_status)) {
        const citaDate = new Date(cliente.appointment_date);
        const diffTime = citaDate.setHours(0,0,0,0) - mxNow.setHours(0,0,0,0);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
            return { 
                tipo: 'AUTO_REMINDER', 
                label: '📅 Mañana: Recordatorio', 
                color: 'orange', 
                fecha: cliente.appointment_date,
                draft: generarDraftMensaje(cliente, 'REMINDER_TOMORROW'),
                hora_envio: '09:00 AM' // Los recordatorios suelen salir en la mañana
            };
        }
        if (diffDays === 0) {
            return { 
                tipo: 'AUTO_REMINDER', 
                label: '🚨 HOY: Recordatorio', 
                color: 'red', 
                fecha: cliente.appointment_date,
                draft: generarDraftMensaje(cliente, 'REMINDER_TODAY'),
                hora_envio: '08:00 AM'
            };
        }
    }

    // SEGUIMIENTOS
    if (cliente.next_follow_up_date && !['NONE', 'AWAITING_REPLY', 'COMPLETED', 'APPOINTMENT'].includes(cliente.crm_intent)) {
        const followUpDate = new Date(cliente.next_follow_up_date);
        const isOverdue = followUpDate <= new Date();

        let intentLabel = cliente.crm_intent;
        if (intentLabel === 'NO_REPLY') intentLabel = 'Recuperación';
        if (intentLabel === 'QUOTE_FOLLOWUP') intentLabel = 'Seguimiento Cotización';
        if (intentLabel === 'FUTURE_CONTACT') intentLabel = 'Contacto Programado';

        const draft = generarDraftMensaje(cliente, cliente.crm_intent);

        if (isOverdue) {
            return { 
                tipo: 'AUTO_MSG', 
                label: `⚡ En cola: ${intentLabel}`, 
                color: 'blue', 
                fecha: cliente.next_follow_up_date,
                draft: draft,
                hora_envio: 'Inmediata (Próximo Cron)'
            };
        } else {
            return { 
                tipo: 'AUTO_MSG_FUTURE', 
                label: `🕑 Programado: ${intentLabel}`, 
                color: 'green', 
                fecha: cliente.next_follow_up_date,
                draft: draft,
                hora_envio: followUpDate.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})
            };
        }
    }

    return { tipo: 'NADA', label: '-', color: 'gray', fecha: null };
};

export const getCrmDashboardV3 = async (req, res) => {
    try {
        console.log("🔄 [V3.1] Generando Matriz de Inteligencia...");

        // 1. SUPABASE (Añadimos unread_count y last_message_analyzed_id)
        const { data: clientesSupa, error: errorSupa } = await supabase
            .from('clientes')
            .select(`
                id, nombre_completo, telefono, crm_intent, crm_status, 
                saldo_pendiente, last_interaction, ai_summary, unread_count,
                appointment_date, appointment_status, next_follow_up_date,
                casos (
                    id, status, monto_cobrado, tecnico_id,
                    profiles!casos_tecnico_id_fkey ( nombre )
                )
            `)
            .not('crm_status', 'in', '("CLOSED","BLOCKED")') 
            .order('last_interaction', { ascending: false })
            .limit(300);

        if (errorSupa) throw new Error(errorSupa.message);

        // 2. MARIADB
        const queryMaria = `
            SELECT 
                a.id AS cita_id, a.start_datetime, a.notas_estructuradas, 
                c.mobile_number, p.first_name AS tecnico_nombre
            FROM ea_appointments a
            LEFT JOIN ea_users c ON a.id_users_customer = c.id
            LEFT JOIN ea_users p ON a.id_users_provider = p.id
            WHERE a.start_datetime >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
        `;
        const [citasMaria] = await pool.execute(queryMaria);

        // 3. UNIFICACIÓN Y CÁLCULO
        const dataV3 = clientesSupa.map(cliente => {
            const telefonoCliente = (cliente.telefono || '').replace(/\D/g, '').slice(-10);
            
            // Match Cita
            let citaReal = citasMaria.find(c => {
                try {
                    const notas = JSON.parse(c.notas_estructuradas || '{}');
                    return cliente.casos?.some(caso => String(caso.id) === String(notas.caso_id));
                } catch { return false; }
            });

            if (!citaReal) {
                citaReal = citasMaria.find(c => (c.mobile_number || '').replace(/\D/g, '').slice(-10) === telefonoCliente);
            }

            // Análisis de Situación (Cancha / Prioridad)
            const situacion = analizarSituacion(cliente, citaReal);

            return {
                id: cliente.id,
                nombre: cliente.nombre_completo,
                telefono: cliente.telefono,
                
                // Intención de IA
                crm_intent: cliente.crm_intent,
                ai_summary: cliente.ai_summary,
                
                // Status Operativo
                unread_count: cliente.unread_count || 0,
                situacion: situacion, // Objeto rico con color, label, draft, etc.

                // Datos Financieros
                saldo_pendiente: parseFloat(cliente.saldo_pendiente || 0),
                
                // Tiempos
                last_interaction: cliente.last_interaction,
                next_action_date: situacion.fecha || null,
                
                // Técnico
                tecnico: citaReal ? citaReal.tecnico_nombre : (cliente.casos?.[0]?.profiles?.nombre || 'Sin Asignar'),
            };
        });

        res.json({ success: true, count: dataV3.length, data: dataV3 });

    } catch (error) {
        console.error("❌ Error V3.1:", error);
        res.status(500).json({ error: error.message });
    }
};