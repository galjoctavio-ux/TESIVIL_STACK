import { supabaseAdmin } from '../services/supabaseClient.js';
import webpush from 'web-push'; // <--- NUEVO
import pool from '../services/eaDatabase.js'; // <--- NUEVO (Para acceder a ea_push_subscriptions)

// --- CONFIGURACIÓN DE WEBPUSH (Reutilizamos las env vars) ---
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@letesolar.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// --- HELPER: ENVIAR PUSH AL TÉCNICO ---
// Esta función conecta el mundo Supabase (UUID) con el mundo Push (E!A ID)
async function enviarPushAlTecnico(tecnicoUuid, titulo, mensaje) {
    try {
        // 1. Obtener el ID numérico de E!A desde el perfil de Supabase
        const { data: perfil } = await supabaseAdmin
            .from('profiles')
            .select('ea_user_id')
            .eq('id', tecnicoUuid)
            .single();

        if (!perfil || !perfil.ea_user_id) {
            console.warn(`⚠️ No se pudo notificar al técnico ${tecnicoUuid}: No tiene ea_user_id.`);
            return;
        }

        const eaUserId = perfil.ea_user_id;

        // 2. Buscar suscripciones en MySQL
        const [subs] = await pool.query('SELECT * FROM ea_push_subscriptions WHERE user_id = ?', [eaUserId]);

        if (subs.length === 0) return; // No tiene celular registrado

        const payload = JSON.stringify({
            title: titulo,
            body: mensaje,
            url: '/billetera' // Al hacer clic, lleva a la billetera
        });

        // 3. Disparar a todos sus dispositivos
        const promesas = subs.map(sub => {
            return webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { auth: sub.auth, p256dh: sub.p256dh }
            }, payload).catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    pool.query('DELETE FROM ea_push_subscriptions WHERE id = ?', [sub.id]);
                }
            });
        });

        await Promise.all(promesas);
        console.log(`🔔 Push enviado a ${subs.length} dispositivos del técnico.`);

    } catch (error) {
        console.error("Error enviando push financiero:", error);
    }
}


// GET /api/finanzas/resumen/:tecnicoId
export const getResumenFinanciero = async (req, res) => {
    const { tecnicoId } = req.params;

    try {
        const { data, error } = await supabaseAdmin
            .from('billetera_transacciones')
            .select('*')
            .eq('tecnico_id', tecnicoId)
            .neq('estado', 'RECHAZADO')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const saldoTotal = data.reduce((acc, curr) => acc + Number(curr.monto), 0);

        res.json({
            saldo_actual: saldoTotal,
            historial: data
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/finanzas/reportar-pago
export const reportarPagoSemanal = async (req, res) => {
    const { tecnicoId, monto, comprobanteUrl } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                tipo: 'PAGO_SEMANAL',
                monto: Math.abs(monto),
                descripcion: 'Depósito semanal reportado',
                comprobante_url: comprobanteUrl,
                estado: 'EN_REVISION'
            });

        if (error) throw error;

        // (Opcional) Aquí podrías notificarte a ti mismo (Admin) si tuvieras suscripción

        res.json({ success: true, message: 'Pago reportado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/finanzas/aprobar/:id
export const aprobarTransaccion = async (req, res) => {
    const { id } = req.params;
    const { accion, adminId } = req.body;

    try {
        const nuevoEstado = accion === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';

        // Traemos datos extra (tipo y descripción) para el mensaje
        const { data: tx, error } = await supabaseAdmin
            .from('billetera_transacciones')
            .update({
                estado: nuevoEstado,
                fecha_aprobacion: new Date(),
                aprobado_por: adminId
            })
            .eq('id', id)
            .select('tecnico_id, monto, tipo, descripcion')
            .single();

        if (error) throw error;

        res.json({ success: true, estado: nuevoEstado });

        // --- NOTIFICACIÓN INTELIGENTE ---
        if (tx && tx.tecnico_id) {
            let titulo = 'Actualización Financiera';
            let cuerpo = '';

            // Personalizamos el mensaje según el tipo
            if (tx.tipo === 'GASTO_OPERATIVO') {
                titulo = accion === 'APROBAR' ? '✅ Gasto Aprobado' : '❌ Gasto Rechazado';
                cuerpo = accion === 'APROBAR'
                    ? `Se validó tu gasto de $${tx.monto}. Se ha sumado a tu saldo.`
                    : `El gasto "${tx.descripcion}" fue rechazado. Revisa con administración.`;
            } else if (tx.tipo === 'PAGO_SEMANAL') {
                titulo = accion === 'APROBAR' ? '✅ Depósito Recibido' : '❌ Depósito Rechazado';
                cuerpo = accion === 'APROBAR'
                    ? `Tu abono de $${tx.monto} ha sido aplicado a tu deuda.`
                    : `No pudimos validar tu depósito de $${tx.monto}.`;
            } else {
                cuerpo = `Tu movimiento de $${tx.monto} fue ${nuevoEstado}.`;
            }

            await enviarPushAlTecnico(tx.tecnico_id, titulo, cuerpo);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/finanzas/bono
export const otorgarBono = async (req, res) => {
    const { tecnicoId, monto, motivo, casoId } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                caso_id: casoId || null,
                tipo: 'BONO',
                monto: Math.abs(monto),
                descripcion: motivo || 'Bono por desempeño',
                estado: 'APROBADO'
            });

        if (error) throw error;

        res.json({ success: true, message: 'Bono aplicado' });

        // --- NOTIFICACIÓN ASÍNCRONA ---
        await enviarPushAlTecnico(
            tecnicoId,
            '🎉 ¡Recibiste un Bono!',
            `Se te acreditaron $${monto} por: ${motivo}`
        );

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 1. NUEVA FUNCIÓN: Reportar Gasto
// POST /api/finanzas/reportar-gasto
export const reportarGasto = async (req, res) => {
    const { tecnicoId, monto, descripcion, comprobanteUrl } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                tipo: 'GASTO_OPERATIVO',
                monto: Math.abs(monto), // POSITIVO (Suma al saldo del técnico, reduce su deuda)
                descripcion: descripcion || 'Gasto operativo',
                comprobante_url: comprobanteUrl, // Foto del ticket
                estado: 'EN_REVISION'
            });

        if (error) throw error;
        res.json({ success: true, message: 'Gasto reportado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ... (resto del código existente) ...

// NUEVA FUNCIÓN: Depósito directo desde Admin
// POST /api/finanzas/deposito-admin
export const realizarDepositoAdmin = async (req, res) => {
    const { tecnicoId, monto, referencia, metodo } = req.body;

    // Validación básica
    if (!tecnicoId || !monto || !referencia) {
        return res.status(400).json({ error: 'Faltan datos requeridos (tecnicoId, monto, referencia)' });
    }

    try {
        // 1. Insertar la transacción como APROBADA directamente
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                tipo: 'DEPOSITO', // Nuevo tipo para diferenciarlo de PAGO_SEMANAL
                monto: Math.abs(monto), // Aseguramos que sea positivo (Suma al saldo del técnico)
                descripcion: `Depósito Admin (${metodo}): ${referencia}`,
                estado: 'APROBADO', // Al hacerlo el admin, entra directo como aprobado
                aprobado_por: req.user ? req.user.id : 'ADMIN_PANEL', // Si tienes el usuario en el request
                fecha_aprobacion: new Date()
            });

        if (error) throw error;

        res.json({ success: true, message: 'Depósito aplicado correctamente' });

        // 2. Notificar al técnico (Reutilizando tu función interna existente)
        await enviarPushAlTecnico(
            tecnicoId,
            '💰 Nuevo Depósito Recibido',
            `Administración te depositó $${monto} vía ${metodo}. Referencia: ${referencia}`
        );

    } catch (error) {
        console.error("Error en depósito admin:", error);
        res.status(500).json({ error: error.message });
    }
};