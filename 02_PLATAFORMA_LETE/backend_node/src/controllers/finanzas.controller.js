import { supabaseAdmin } from '../services/supabaseClient.js';

// GET /api/finanzas/resumen/:tecnicoId
export const getResumenFinanciero = async (req, res) => {
    const { tecnicoId } = req.params;

    try {
        // Traemos todo lo que NO haya sido rechazado por el admin
        const { data, error } = await supabaseAdmin
            .from('billetera_transacciones')
            .select('*')
            .eq('tecnico_id', tecnicoId)
            .neq('estado', 'RECHAZADO')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculamos el saldo sumando todo
        const saldoTotal = data.reduce((acc, curr) => acc + Number(curr.monto), 0);

        res.json({
            saldo_actual: saldoTotal, // Si es negativo, debe dinero. Si es positivo, se le debe.
            historial: data
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/finanzas/reportar-pago (El técnico avisa que ya depositó)
export const reportarPagoSemanal = async (req, res) => {
    const { tecnicoId, monto, comprobanteUrl } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                tipo: 'PAGO_SEMANAL',
                monto: Math.abs(monto), // Positivo, porque está "pagando" su deuda
                descripcion: 'Depósito semanal reportado',
                comprobante_url: comprobanteUrl,
                estado: 'EN_REVISION' // <--- Requiere tu aprobación
            });

        if (error) throw error;
        res.json({ success: true, message: 'Pago reportado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/finanzas/aprobar/:id
export const aprobarTransaccion = async (req, res) => {
    const { id } = req.params;
    const { accion, adminId } = req.body; // 'APROBAR' o 'RECHAZAR'

    try {
        const nuevoEstado = accion === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';

        // 1. Actualizar la transacción
        const { data: tx, error } = await supabaseAdmin
            .from('billetera_transacciones')
            .update({
                estado: nuevoEstado,
                fecha_aprobacion: new Date(),
                aprobado_por: adminId // Guardamos quién autorizó
            })
            .eq('id', id)
            .select('*, tecnico:tecnico_id(id)') // Traemos el técnico para notificarle
            .single();

        if (error) throw error;

        // 2. (Opcional) Crear Notificación en BD para el técnico
        if (tx) {
            const mensaje = accion === 'APROBAR'
                ? `✅ Tu depósito de $${tx.monto} ha sido aprobado.`
                : `❌ Tu depósito de $${tx.monto} fue rechazado. Revisa el comprobante.`;

            // Insertamos en tabla de notificaciones (si tienes una)
            // await supabaseAdmin.from('notifications').insert({ userId: tx.tecnico_id, message: mensaje });
        }

        res.json({ success: true, estado: nuevoEstado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/finanzas/bono
export const otorgarBono = async (req, res) => {
    const { tecnicoId, monto, motivo, casoId } = req.body;

    try {
        // 1. Crear la transacción de BONO (Saldo a favor del técnico)
        const { data: tx, error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                caso_id: casoId || null, // Opcional: Ligar a un caso específico
                tipo: 'BONO',
                monto: Math.abs(monto), // Positivo (+)
                descripcion: motivo || 'Bono por excelencia',
                estado: 'APROBADO'
            })
            .select()
            .single();

        if (error) throw error;

        // 2. LOGICA DE NOTIFICACIÓN
        // Aquí es donde "Suena" el celular del técnico.
        // Simularemos que insertamos en una tabla de notificaciones interna o usaríamos web-push

        // Ejemplo simple: Devolvemos el éxito y el frontend admin confirma
        console.log(`🔔 Notificación enviada al técnico ${tecnicoId}: Ganaste $${monto}`);

        res.json({ success: true, message: 'Bono aplicado y notificado', data: tx });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};