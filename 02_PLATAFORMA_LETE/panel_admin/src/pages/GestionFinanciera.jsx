import React, { useEffect, useState } from 'react';
import api from '../apiService';
import Modal from '../components/Modal'; // Tu componente modal genérico
import './GestionFinanciera.css';

const GestionFinanciera = () => {
    const [activeTab, setActiveTab] = useState('pendientes');
    const [pendientes, setPendientes] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estado para Modales
    const [bonoModalOpen, setBonoModalOpen] = useState(false);
    const [depositoModalOpen, setDepositoModalOpen] = useState(false); // NUEVO
    const [selectedTecnico, setSelectedTecnico] = useState(null);
    const [historialModalOpen, setHistorialModalOpen] = useState(false);
    const [historial, setHistorial] = useState([]);

    // Datos formulario Bono
    const [bonoData, setBonoData] = useState({ monto: 100, motivo: 'Felicitación Cliente (WhatsApp)', casoId: '' });

    // Datos formulario Depósito (NUEVO)
    const [depositoData, setDepositoData] = useState({ monto: '', referencia: '', metodo: 'Transferencia' });

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            // Simulamos llamada a API de técnicos
            const { data: users } = await api.get('/usuarios?rol=tecnico');

            const techsWithFinance = await Promise.all(users.map(async (t) => {
                const res = await api.get(`/finanzas/resumen/${t.id}`);
                return {
                    ...t,
                    saldo: res.data.saldo_actual,
                    pendientes: res.data.historial.filter(h => h.estado === 'EN_REVISION')
                };
            }));

            setTecnicos(techsWithFinance);

            const todosPendientes = techsWithFinance.flatMap(t =>
                t.pendientes.map(p => ({ ...p, tecnicoNombre: t.nombre }))
            );
            setPendientes(todosPendientes);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAprobar = async (id, accion) => {
        if (!window.confirm(`¿Estás seguro de ${accion} este pago?`)) return;
        try {
            await api.put(`/finanzas/aprobar/${id}`, { accion });
            cargarDatos();
        } catch (error) {
            alert('Error al procesar');
        }
    };

    // --- LÓGICA BONOS ---
    const openBonoModal = (tech) => {
        setSelectedTecnico(tech);
        setBonoData({ monto: 100, motivo: 'Felicitación Cliente (WhatsApp)', casoId: '' });
        setBonoModalOpen(true);
    };

    const enviarBono = async () => {
        try {
            await api.post('/finanzas/bono', {
                tecnicoId: selectedTecnico.id,
                monto: bonoData.monto,
                motivo: bonoData.motivo,
                casoId: bonoData.casoId
            });
            alert('🎉 Bono enviado y notificado');
            setBonoModalOpen(false);
            cargarDatos();
        } catch (error) {
            alert('Error enviando bono');
        }
    };

    // --- LÓGICA DEPÓSITOS (NUEVO) ---
    const openDepositoModal = (tech) => {
        setSelectedTecnico(tech);
        setDepositoData({ monto: '', referencia: '', metodo: 'Transferencia' });
        setDepositoModalOpen(true);
    };

    const enviarDeposito = async (e) => {
        e.preventDefault();
        if (!depositoData.monto || !depositoData.referencia) return alert("Faltan datos");

        try {
            // Este endpoint lo crearemos en el backend en el siguiente paso
            await api.post('/finanzas/deposito-admin', {
                tecnicoId: selectedTecnico.id,
                monto: parseFloat(depositoData.monto),
                referencia: depositoData.referencia,
                metodo: depositoData.metodo
            });
            alert(`✅ Depósito registrado a ${selectedTecnico.nombre}`);
            setDepositoModalOpen(false);
            cargarDatos();
        } catch (error) {
            console.error(error);
            alert('Error al registrar el depósito. Verifica la conexión.');
        }
    };

    const verHistorial = async (tech) => {
        setSelectedTecnico(tech);
        try {
            const { data } = await api.get(`/finanzas/resumen/${tech.id}`);
            setHistorial(data.historial);
            setHistorialModalOpen(true);
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="loading-state">Cargando Finanzas...</div>;

    return (
        <div className="finanzas-container">
            <header className="finanzas-header">
                <h1>Control Financiero 🏦</h1>
                <div className="tabs">
                    <button className={activeTab === 'pendientes' ? 'active' : ''} onClick={() => setActiveTab('pendientes')}>
                        🔔 Por Autorizar ({pendientes.length})
                    </button>
                    <button className={activeTab === 'tecnicos' ? 'active' : ''} onClick={() => setActiveTab('tecnicos')}>
                        👷 Saldos Técnicos
                    </button>
                </div>
            </header>

            {/* TAB 1: PENDIENTES */}
            {activeTab === 'pendientes' && (
                <div className="tab-content">
                    {pendientes.length === 0 ? <p className="empty-state">Todo al día. No hay depósitos pendientes.</p> : (
                        <div className="grid-pendientes">
                            {pendientes.map(tx => (
                                <div key={tx.id} className="card-pendiente">
                                    <div className="cp-header">
                                        <span className="cp-tech">{tx.tecnicoNombre}</span>
                                        <span className="cp-date">{new Date(tx.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="cp-body">
                                        <h3>${Number(tx.monto).toFixed(2)}</h3>
                                        <p>{tx.descripcion}</p>
                                        {tx.comprobante_url && (
                                            <a href={tx.comprobante_url} target="_blank" rel="noreferrer" className="link-comprobante">
                                                Ver Comprobante 📎
                                            </a>
                                        )}
                                    </div>
                                    <div className="cp-actions">
                                        <button className="btn-reject" onClick={() => handleAprobar(tx.id, 'RECHAZAR')}>Rechazar</button>
                                        <button className="btn-approve" onClick={() => handleAprobar(tx.id, 'APROBAR')}>Autorizar ✅</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: TÉCNICOS */}
            {activeTab === 'tecnicos' && (
                <div className="tab-content">
                    <table className="tabla-saldos">
                        <thead>
                            <tr>
                                <th>Técnico</th>
                                <th>Estado de Cuenta</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tecnicos.map(tech => (
                                <tr key={tech.id}>
                                    <td>
                                        <strong>{tech.nombre}</strong><br />
                                        <small>{tech.email}</small>
                                    </td>
                                    <td>
                                        <span className={`badge-saldo ${tech.saldo < 0 ? 'deudor' : 'acreedor'}`}>
                                            {tech.saldo < 0 ? `Debe $${Math.abs(tech.saldo)}` : `A favor $${tech.saldo}`}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button className="btn-icon" onClick={() => verHistorial(tech)} title="Ver Movimientos">📜</button>
                                            <button className="btn-icon-bonus" onClick={() => openBonoModal(tech)} title="Dar Bono">🎁</button>
                                            {/* Nuevo Botón de Depósito */}
                                            <button
                                                className="btn-icon"
                                                style={{ backgroundColor: '#10b981', color: 'white', border: 'none' }}
                                                onClick={() => openDepositoModal(tech)}
                                                title="Realizar Depósito (Caja Chica/Material)"
                                            >
                                                💰
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL BONO */}
            <Modal isOpen={bonoModalOpen} onClose={() => setBonoModalOpen(false)}>
                <div className="modal-bono">
                    <h3>🎁 Otorgar Bono a {selectedTecnico?.nombre}</h3>
                    <div className="form-group">
                        <label>Motivo</label>
                        <select
                            value={bonoData.motivo}
                            onChange={e => setBonoData({ ...bonoData, motivo: e.target.value })}
                            style={{ width: '100%', padding: '8px' }}
                        >
                            <option value="Felicitación Cliente (WhatsApp)">Felicitación Cliente (WhatsApp)</option>
                            <option value="Trabajo Extraordinario">Trabajo Extraordinario</option>
                            <option value="Apoyo Gasolina/Viáticos">Apoyo Gasolina/Viáticos</option>
                            <option value="Ajuste de Saldo">Ajuste de Saldo</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Monto ($)</label>
                        <input
                            type="number"
                            value={bonoData.monto}
                            onChange={e => setBonoData({ ...bonoData, monto: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label>ID Caso (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: 1450"
                            value={bonoData.casoId}
                            onChange={e => setBonoData({ ...bonoData, casoId: e.target.value })}
                        />
                    </div>
                    <button className="btn-primary-full" onClick={enviarBono}>Enviar Premio</button>
                </div>
            </Modal>

            {/* MODAL DEPÓSITO (NUEVO) */}
            <Modal isOpen={depositoModalOpen} onClose={() => setDepositoModalOpen(false)}>
                <div className="modal-bono">
                    <h3 style={{ color: '#10b981' }}>💰 Realizar Depósito a {selectedTecnico?.nombre}</h3>
                    <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '15px' }}>
                        Este monto se sumará a la billetera del técnico (Saldo a Favor) y se le enviará una notificación.
                    </p>
                    <form onSubmit={enviarDeposito}>
                        <div className="form-group">
                            <label>Método de Pago</label>
                            <select
                                value={depositoData.metodo}
                                onChange={e => setDepositoData({ ...depositoData, metodo: e.target.value })}
                                style={{ width: '100%', padding: '8px' }}
                            >
                                <option value="Transferencia">Transferencia Bancaria</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Deposito OXXO">Depósito OXXO</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Monto a Depositar ($)</label>
                            <input
                                type="number"
                                required
                                min="1"
                                placeholder="0.00"
                                value={depositoData.monto}
                                onChange={e => setDepositoData({ ...depositoData, monto: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Referencia / Folio</label>
                            <input
                                type="text"
                                required
                                placeholder="Ej: SPEI-55432 o Concepto"
                                value={depositoData.referencia}
                                onChange={e => setDepositoData({ ...depositoData, referencia: e.target.value })}
                            />
                        </div>
                        <button className="btn-primary-full" style={{ backgroundColor: '#10b981' }} type="submit">
                            Confirmar Depósito
                        </button>
                    </form>
                </div>
            </Modal>

            {/* MODAL HISTORIAL */}
            <Modal isOpen={historialModalOpen} onClose={() => setHistorialModalOpen(false)}>
                <div className="modal-historial">
                    <h3>Historial: {selectedTecnico?.nombre}</h3>
                    <div className="historial-scroll">
                        <table className="tabla-mini">
                            <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Estado</th></tr></thead>
                            <tbody>
                                {historial.map(h => (
                                    <tr key={h.id}>
                                        <td>{new Date(h.created_at).toLocaleDateString()}</td>
                                        <td>
                                            {h.descripcion}
                                            {h.caso_id && <span style={{ display: 'block', fontSize: '0.7em', color: 'blue' }}>Caso #{h.caso_id}</span>}
                                        </td>
                                        <td className={h.monto >= 0 ? 'pos' : 'neg'}>${h.monto}</td>
                                        <td>{h.estado}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GestionFinanciera;