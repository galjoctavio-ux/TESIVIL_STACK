import React, { useEffect, useState } from 'react';
import api from '../apiService';
import { useAuth } from '../context/AuthContext';
import './MiBilletera.css';

const MiBilletera = () => {
    const { user } = useAuth();
    const [resumen, setResumen] = useState({ saldo_actual: 0, historial: [] });
    const [loading, setLoading] = useState(true);

    // Estado del formulario (Ahora maneja 'deposito' o 'gasto' o null)
    const [activeForm, setActiveForm] = useState(null);

    // Campos
    const [monto, setMonto] = useState('');
    const [descripcion, setDescripcion] = useState(''); // Para gastos o referencia deposito
    const [sending, setSending] = useState(false);

    useEffect(() => { if (user?.id) cargarDatos(); }, [user]);

    const cargarDatos = async () => {
        try {
            const { data } = await api.get(`/finanzas/resumen/${user.id}`);
            setResumen(data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
            const endpoint = activeForm === 'gasto'
                ? '/finanzas/reportar-gasto'
                : '/finanzas/reportar-pago';

            const payload = {
                tecnicoId: user.id,
                monto: parseFloat(monto),
                // Mapeamos los campos según lo que espera el backend
                descripcion: activeForm === 'gasto' ? descripcion : 'Depósito Semanal',
                // En deposito, la descripción servía de referencia en la V1. 
                // Ahora usamos 'comprobanteUrl' para guardar la referencia/foto simulada
                comprobanteUrl: activeForm === 'gasto' ? 'FOTO_TICKET_URL_SIMULADA' : descripcion
            };

            await api.post(endpoint, payload);

            alert(activeForm === 'gasto' ? '✅ Gasto reportado' : '✅ Depósito reportado');
            cerrarFormulario();
            cargarDatos();
        } catch (error) {
            console.error(error);
            alert('Error al enviar reporte.');
        } finally {
            setSending(false);
        }
    };

    const cerrarFormulario = () => {
        setActiveForm(null);
        setMonto('');
        setDescripcion('');
    };

    if (loading) return <div className="p-4">Cargando...</div>;

    const saldo = Number(resumen.saldo_actual);
    const esDeudor = saldo < 0;

    // Clases CSS
    let cardClass = saldo > 0 ? 'saldo-card favor' : saldo < 0 ? 'saldo-card deuda' : 'saldo-card neutro';

    return (
        <div className="billetera-container">
            <header className="billetera-header">
                <h2>Mi Billetera 💼</h2>
                <p>Gestión de efectivo y gastos</p>
            </header>

            <div className={cardClass}>
                <span className="saldo-titulo">
                    {saldo < 0 ? 'Debes a LETE' : saldo > 0 ? 'Saldo a favor' : 'Estás al día'}
                </span>
                <h1 className="saldo-monto">${Math.abs(saldo).toFixed(2)}</h1>
                <p className="saldo-info">{saldo < 0 ? 'Debes depositar efectivo.' : 'La empresa te debe.'}</p>
            </div>

            {/* BOTONES DE ACCIÓN */}
            {!activeForm && (
                <div className="acciones-grid">
                    {/* Botón Depósito (Solo si debe dinero) */}
                    {esDeudor ? (
                        <button className="btn-reportar" onClick={() => setActiveForm('deposito')}>
                            📤 Reportar Depósito
                        </button>
                    ) : (
                        <div style={{/* Espacio vacío para mantener grid */ }}></div>
                    )}

                    {/* Botón Gasto (Siempre disponible) */}
                    <button className="btn-gasto" onClick={() => setActiveForm('gasto')}>
                        🛒 Reportar Gasto
                    </button>
                </div>
            )}

            {/* FORMULARIO DINÁMICO */}
            {activeForm && (
                <div className="form-deposito">
                    <h3 style={{ marginTop: 0, color: '#334155' }}>
                        {activeForm === 'gasto' ? '🛒 Reportar Compra/Gasto' : '🏦 Reportar Depósito'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Monto ($)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={monto}
                                onChange={e => setMonto(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                {activeForm === 'gasto' ? 'Concepto / Justificación' : 'Referencia / Folio Banco'}
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                placeholder={activeForm === 'gasto' ? 'Ej: 5m cable calibre 10' : 'Ej: Transferencia 1234'}
                                required
                            />
                        </div>

                        {activeForm === 'gasto' && (
                            <div className="form-group">
                                <label>Foto del Ticket 📸</label>
                                <input type="file" accept="image/*" style={{ width: '100%' }} />
                                <small style={{ color: '#94a3b8' }}>(Simulado por ahora)</small>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={cerrarFormulario}
                                style={{ background: '#e2e8f0', color: '#334155', flex: 1, border: 'none', borderRadius: '8px', padding: '10px' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={sending}
                                style={{ background: activeForm === 'gasto' ? '#f97316' : '#3b82f6', color: 'white', flex: 1, border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }}
                            >
                                {sending ? 'Enviando...' : 'Enviar Reporte'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* HISTORIAL (Igual que antes) */}
            <div className="historial-section">
                <h3 className="historial-title">Movimientos Recientes</h3>
                {resumen.historial.map((tx) => (
                    <div key={tx.id} className="tx-item">
                        <div className="tx-left">
                            <div className={`tx-icon ${tx.monto < 0 ? 'bg-red' : tx.tipo === 'GASTO_OPERATIVO' ? 'bg-blue' : 'bg-green'}`}>
                                {tx.tipo === 'VISITA_COMISION' && '🛠️'}
                                {tx.tipo === 'COBRO_EFECTIVO' && '💵'}
                                {tx.tipo === 'BONO' && '🎉'}
                                {tx.tipo === 'PAGO_SEMANAL' && '🏦'}
                                {tx.tipo === 'GASTO_OPERATIVO' && '🛒'}
                            </div>
                            <div className="tx-data">
                                <h4>
                                    {tx.tipo === 'GASTO_OPERATIVO' ? 'Reembolso Gasto' :
                                        tx.descripcion || tx.tipo}
                                </h4>
                                <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                                {tx.estado !== 'APROBADO' && <span className={`tx-badge ${tx.estado.toLowerCase()}`}> {tx.estado} </span>}
                            </div>
                        </div>
                        <div className="tx-right">
                            <span className={`tx-amount ${tx.monto >= 0 ? 'pos' : 'neg'}`}>
                                {tx.monto >= 0 ? '+' : ''}{Number(tx.monto).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MiBilletera;