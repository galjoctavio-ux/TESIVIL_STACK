import React, { useEffect, useState } from 'react';
import api from '../apiService';
import { useAuth } from '../context/AuthContext';
import './MiBilletera.css';

const MiBilletera = () => {
    const { user } = useAuth();
    const [resumen, setResumen] = useState({ saldo_actual: 0, historial: [] });
    const [loading, setLoading] = useState(true);

    // Estado del formulario
    const [showForm, setShowForm] = useState(false);
    const [montoDeposito, setMontoDeposito] = useState('');
    const [referencia, setReferencia] = useState(''); // Folio o URL simulación
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (user?.id) cargarDatos();
    }, [user]);

    const cargarDatos = async () => {
        try {
            // endpoint: /api/finanzas/resumen/:tecnicoId
            const { data } = await api.get(`/finanzas/resumen/${user.id}`);
            setResumen(data);
        } catch (error) {
            console.error("Error cargando billetera:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReportarPago = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            await api.post('/finanzas/reportar-pago', {
                tecnicoId: user.id,
                monto: parseFloat(montoDeposito),
                // En un futuro aquí subirías la foto a Supabase Storage y mandarías la URL
                comprobanteUrl: referencia || 'Referencia Texto'
            });

            alert('✅ Pago reportado correctamente. Espera aprobación del Admin.');
            setShowForm(false);
            setMontoDeposito('');
            setReferencia('');
            cargarDatos(); // Recargar para ver el movimiento "En Revisión"
        } catch (error) {
            console.error(error);
            alert('Error al reportar el pago.');
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="p-4">Cargando Billetera...</div>;

    // Lógica visual
    const saldo = Number(resumen.saldo_actual);
    const esDeudor = saldo < 0; // Si es negativo, DEBE a la empresa
    const esAcreedor = saldo > 0; // Si es positivo, LA EMPRESA LE DEBE

    // Clases CSS dinámicas
    let cardClass = 'saldo-card neutro';
    if (esDeudor) cardClass = 'saldo-card deuda';
    if (esAcreedor) cardClass = 'saldo-card favor';

    return (
        <div className="billetera-container">
            <header className="billetera-header">
                <h2>Mi Billetera 💼</h2>
                <p>Gestión de efectivo y comisiones</p>
            </header>

            {/* TARJETA PRINCIPAL */}
            <div className={cardClass}>
                <span className="saldo-titulo">
                    {esDeudor ? 'Debes a LETE' : esAcreedor ? 'Saldo a tu favor' : 'Estás al día'}
                </span>
                <h1 className="saldo-monto">
                    ${Math.abs(saldo).toFixed(2)}
                </h1>
                <p className="saldo-info">
                    {esDeudor
                        ? 'Acumulado de cobros en efectivo.'
                        : 'Comisiones pendientes de pago.'}
                </p>
            </div>

            {/* BOTÓN / FORMULARIO */}
            {esDeudor && (
                <>
                    {!showForm ? (
                        <button className="btn-reportar" onClick={() => setShowForm(true)}>
                            📤 Reportar Depósito a Empresa
                        </button>
                    ) : (
                        <div className="form-deposito">
                            <h3 style={{ marginTop: 0, color: '#334155' }}>Reportar Pago Semanal</h3>
                            <form onSubmit={handleReportarPago}>
                                <div className="form-group">
                                    <label>Monto Depositado ($)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={montoDeposito}
                                        onChange={e => setMontoDeposito(e.target.value)}
                                        placeholder="Ej: 1500"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Referencia / Folio</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={referencia}
                                        onChange={e => setReferencia(e.target.value)}
                                        placeholder="Ej: Transferencia BBVA 4921"
                                        required
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        style={{ background: '#e2e8f0', color: '#334155', flex: 1, border: 'none', borderRadius: '8px', padding: '10px' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        style={{ background: '#22c55e', color: 'white', flex: 1, border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }}
                                    >
                                        {sending ? 'Enviando...' : 'Confirmar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </>
            )}

            {/* HISTORIAL */}
            <div className="historial-section">
                <h3 className="historial-title">Últimos Movimientos</h3>

                {resumen.historial.length === 0 ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center' }}>No hay movimientos recientes.</p>
                ) : (
                    resumen.historial.map((tx) => (
                        <div key={tx.id} className="tx-item">
                            <div className="tx-left">
                                {/* Icono según tipo */}
                                <div className={`tx-icon ${tx.monto < 0 ? 'bg-red' : 'bg-green'}`}>
                                    {tx.tipo === 'VISITA_COMISION' && '🛠️'}
                                    {tx.tipo === 'COBRO_EFECTIVO' && '💵'}
                                    {tx.tipo === 'BONO' && '🎉'}
                                    {tx.tipo === 'PAGO_SEMANAL' && '🏦'}
                                </div>
                                <div className="tx-data">
                                    <h4>
                                        {tx.tipo === 'VISITA_COMISION' ? 'Comisión Visita' :
                                            tx.tipo === 'COBRO_EFECTIVO' ? 'Cobro a Cliente' :
                                                tx.descripcion}
                                    </h4>
                                    <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                                    {tx.estado !== 'APROBADO' && (
                                        <span className={`tx-badge ${tx.estado.toLowerCase()}`}>
                                            {' '}{tx.estado}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="tx-right">
                                <span className={`tx-amount ${tx.monto < 0 ? 'neg' : 'pos'}`}>
                                    {tx.monto > 0 ? '+' : ''}{Number(tx.monto).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MiBilletera;