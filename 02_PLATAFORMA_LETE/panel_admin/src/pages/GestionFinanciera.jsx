import React, { useEffect, useState } from 'react';
import api from '../apiService';
import Modal from '../components/Modal'; // Tu componente modal genérico
import './GestionFinanciera.css'; // Lo crearemos abajo

const GestionFinanciera = () => {
    const [activeTab, setActiveTab] = useState('pendientes');
    const [pendientes, setPendientes] = useState([]);
    const [tecnicos, setTecnicos] = useState([]); // Lista de técnicos con saldos
    const [loading, setLoading] = useState(true);

    // Estado para Modales
    const [bonoModalOpen, setBonoModalOpen] = useState(false);
    const [selectedTecnico, setSelectedTecnico] = useState(null);
    const [historialModalOpen, setHistorialModalOpen] = useState(false);
    const [historial, setHistorial] = useState([]);

    // Datos formulario Bono
    const [bonoData, setBonoData] = useState({ monto: 100, motivo: 'Felicitación Cliente (WhatsApp)', casoId: '' });

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            // 1. Obtener Transacciones Pendientes (Globales)
            // Necesitamos un endpoint nuevo o filtrar en cliente. 
            // Para este ejemplo, asumiremos que traemos todo y filtramos en cliente o creas un endpoint específico
            // NOTA: Para hacerlo rápido, usaremos la lógica de listar técnicos y dentro sus pendientes, 
            // pero lo ideal es un endpoint '/finanzas/pendientes'.

            // Simulamos llamada a API de técnicos (usamos tu endpoint existente de usuarios y luego pedimos sus finanzas)
            const { data: users } = await api.get('/usuarios?rol=tecnico');

            // Calcular saldos y buscar pendientes (Esto es pesado, idealmente el backend lo hace)
            // Por simplicidad del MVP, iteramos:
            const techsWithFinance = await Promise.all(users.map(async (t) => {
                const res = await api.get(`/finanzas/resumen/${t.id}`);
                return {
                    ...t,
                    saldo: res.data.saldo_actual,
                    pendientes: res.data.historial.filter(h => h.estado === 'EN_REVISION')
                };
            }));

            setTecnicos(techsWithFinance);

            // Aplanar lista de pendientes para la pestaña 1
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
            cargarDatos(); // Recargar todo
        } catch (error) {
            alert('Error al procesar');
        }
    };

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
                                        <button className="btn-icon" onClick={() => verHistorial(tech)} title="Ver Movimientos">📜</button>
                                        <button className="btn-icon-bonus" onClick={() => openBonoModal(tech)} title="Dar Bono">🎁</button>
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
                        <label>ID Caso (Opcional - Para referencia)</label>
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

            {/* MODAL HISTORIAL (Simple tabla de movimientos) */}
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