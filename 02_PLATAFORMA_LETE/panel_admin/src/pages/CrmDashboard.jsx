import React, { useEffect, useState } from 'react';
import { getCrmDashboard, forceAnalyze } from '../apiService';
import ChatModal from '../components/ChatModal';
import './CrmDashboard.css';

const CrmDashboard = () => {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('TODOS'); // TODOS, ALERTA, ADMIN, CITA, ATENCION, SEGUIMIENTO

    const [selectedClientForChat, setSelectedClientForChat] = useState(null);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const data = await getCrmDashboard();
            setClientes(data);
        } catch (error) {
            console.error("Error cargando CRM:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleAnalizar = async (id) => {
        if (!confirm("¿Forzar análisis de IA para este cliente?")) return;
        await forceAnalyze(id);
        alert("Solicitud enviada. La IA procesará el chat en breve.");
        setTimeout(cargarDatos, 2000);
    };

    // --- LÓGICA DE FILTRADO ---
    const clientesFiltrados = clientes.filter(c => {
        if (filtro === 'TODOS') return true;
        if (filtro === 'ALERTA') return c.crm_intent === 'OPERATIONAL_ALERT';
        if (filtro === 'ADMIN') return c.crm_intent === 'ADMIN_TASK';
        return c.prioridad_visual === filtro;
    });

    // --- LÓGICA DE BADGES (ETIQUETAS) ---
    const getBadgeInfo = (intent, prioridadVisual) => {
        switch (intent) {
            case 'OPERATIONAL_ALERT':
                return { class: 'badge-alert', label: '🚨 ALERTA' };
            case 'ADMIN_TASK':
                return { class: 'badge-admin', label: '📄 TRAMITE' };
            default:
                switch (prioridadVisual) {
                    case 'CITA': return { class: 'badge-cita', label: intent };
                    case 'ATENCION': return { class: 'badge-atencion', label: intent };
                    case 'SEGUIMIENTO': return { class: 'badge-seguimiento', label: intent };
                    case 'GHOST': return { class: 'badge-ghost', label: 'GHOST' };
                    default: return { class: 'badge-normal', label: intent || 'NONE' };
                }
        }
    };

    // Contadores
    const countAlerts = clientes.filter(c => c.crm_intent === 'OPERATIONAL_ALERT').length;
    const countAdmin = clientes.filter(c => c.crm_intent === 'ADMIN_TASK').length;

    return (
        <div className="crm-container">
            {/* HEADER */}
            <header className="crm-header">
                <div>
                    <h1>🧠 Cerebro CRM</h1>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>Auditoría & Ventas</p>
                </div>

                <div className="crm-controls">
                    {/* Botones de Auditoría */}
                    {countAlerts > 0 && (
                        <button
                            onClick={() => setFiltro('ALERTA')}
                            className={`btn-alert ${filtro === 'ALERTA' ? 'active' : ''}`}
                        >
                            🚨 ALERTAS ({countAlerts})
                        </button>
                    )}
                    <button onClick={() => setFiltro('ADMIN')} className={filtro === 'ADMIN' ? 'active' : ''}>
                        📄 Admin ({countAdmin})
                    </button>

                    <div className="divider-vertical"></div>

                    {/* Botones de Ventas */}
                    <button onClick={() => setFiltro('TODOS')} className={filtro === 'TODOS' ? 'active' : ''}>Todos</button>
                    <button onClick={() => setFiltro('CITA')} className={filtro === 'CITA' ? 'active' : ''}>📅 Citas</button>
                    <button onClick={() => setFiltro('ATENCION')} className={filtro === 'ATENCION' ? 'active' : ''}>🔥 Atención</button>

                    <button onClick={cargarDatos} className="refresh-btn" title="Recargar">🔄</button>
                </div>
            </header>

            {/* TABLA */}
            {loading ? <p>Analizando operaciones...</p> : (
                <div className="crm-table-wrapper">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Estado</th>
                                <th>Último Mensaje</th> {/* RECUPERADO */}
                                <th>Análisis IA</th>
                                <th>Próxima Acción</th> {/* RECUPERADO */}
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientesFiltrados.map(cliente => {
                                const badge = getBadgeInfo(cliente.crm_intent, cliente.prioridad_visual);

                                return (
                                    <tr key={cliente.cliente_id} className={cliente.crm_intent === 'OPERATIONAL_ALERT' ? 'row-alert' : ''}>

                                        {/* 1. Cliente (+ Deuda recuperada) */}
                                        <td>
                                            <div className="client-info">
                                                <strong>{cliente.nombre_completo || 'Desconocido'}</strong>
                                                <span className="phone">{cliente.telefono}</span>
                                                {/* Recuperamos el badge de deuda */}
                                                {cliente.saldo_pendiente > 0 && (
                                                    <span className="debt-badge">Debe: ${cliente.saldo_pendiente}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 2. Estado (Badge) */}
                                        <td>
                                            <span className={`badge ${badge.class}`}>
                                                {badge.label}
                                            </span>
                                        </td>

                                        {/* 3. Último Mensaje Real (RECUPERADO) */}
                                        <td className="msg-cell">
                                            <div className={`msg-bubble ${cliente.ultimo_mensaje_rol === 'assistant' ? 'assistant' : 'user'}`}>
                                                {cliente.ultimo_mensaje_texto || '(Sin mensajes)'}
                                            </div>
                                            <div className="time">
                                                {cliente.last_interaction
                                                    ? new Date(cliente.last_interaction).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })
                                                    : ''}
                                            </div>
                                        </td>

                                        {/* 4. Razón IA */}
                                        <td style={{ maxWidth: '250px' }}>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', lineHeight: '1.4' }}>
                                                {cliente.ai_summary || cliente.razon_ia || 'Sin análisis'}
                                            </p>
                                        </td>

                                        {/* 5. Próxima Acción (RECUPERADO) */}
                                        <td>
                                            {cliente.next_follow_up_date ? (
                                                <div className="follow-up">
                                                    📅 {new Date(cliente.next_follow_up_date).toLocaleDateString()}
                                                    <br />
                                                    ⏰ {new Date(cliente.next_follow_up_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#aaa' }}>-</span>
                                            )}
                                        </td>

                                        {/* 6. Acciones */}
                                        <td>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button
                                                    className="action-btn chat-btn"
                                                    onClick={() => setSelectedClientForChat(cliente)}
                                                    title="Ver historial completo"
                                                >
                                                    💬
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleAnalizar(cliente.cliente_id)}
                                                    title="Forzar re-análisis"
                                                >
                                                    ⚡
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedClientForChat && (
                <ChatModal
                    cliente={selectedClientForChat}
                    onClose={() => setSelectedClientForChat(null)}
                />
            )}
        </div>
    );
};

export default CrmDashboard;