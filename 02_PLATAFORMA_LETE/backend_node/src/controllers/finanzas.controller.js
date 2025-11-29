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

// PUT /api/finanzas/aprobar/:id (Admin aprueba o rechaza)
export const aprobarTransaccion = async (req, res) => {
    const { id } = req.params;
    const { accion } = req.body; // 'APROBAR' o 'RECHAZAR'

    try {
        const nuevoEstado = accion === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';

        // Si se rechaza, el monto deja de contar en el saldo (gracias al filtro del getResumen)
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .update({
                estado: nuevoEstado,
                fecha_aprobacion: new Date()
            })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, estado: nuevoEstado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/finanzas/bono (Admin regala dinero por buen servicio)
export const otorgarBono = async (req, res) => {
    const { tecnicoId, monto, motivo } = req.body;

    try {
        const { error } = await supabaseAdmin
            .from('billetera_transacciones')
            .insert({
                tecnico_id: tecnicoId,
                tipo: 'BONO',
                monto: Math.abs(monto), // Siempre positivo
                descripcion: motivo || 'Bono por desempeño',
                estado: 'APROBADO' // Aprobado directo porque lo hace el admin
            });

        if (error) throw error;
        res.json({ success: true, message: 'Bono aplicado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};