import React, { useEffect, useState, useMemo } from 'react';
import { getCrmDashboard, forceAnalyze } from '../apiService';
import ChatModal from '../components/ChatModal';
import './CrmDashboard.css';

const CrmDashboard = () => {
    // --- ESTADOS DE DATOS ---
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- ESTADOS DE INTERFAZ ---
    const [filtro, setFiltro] = useState('TODOS'); // Pestañas: TODOS, ALERTA, ADMIN...
    const [busqueda, setBusqueda] = useState('');  // Buscador de texto
    const [orden, setOrden] = useState({ key: 'last_interaction', direction: 'desc' }); // Ordenamiento
    const [paginaActual, setPaginaActual] = useState(1);
    const itemsPorPagina = 20;

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

    // Resetear a página 1 si cambia el filtro o la búsqueda
    useEffect(() => {
        setPaginaActual(1);
    }, [filtro, busqueda]);

    const handleAnalizar = async (id) => {
        if (!confirm("¿Forzar análisis de IA para este cliente?")) return;
        await forceAnalyze(id);
        alert("Solicitud enviada. Recargando en 3s...");
        setTimeout(cargarDatos, 3000);
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (orden.key === key && orden.direction === 'asc') {
            direction = 'desc';
        }
        setOrden({ key, direction });
    };

    // --- LÓGICA DE FILTRADO, ORDENAMIENTO Y PAGINACIÓN (MEMORIZADA) ---
    const datosProcesados = useMemo(() => {
        let data = [...clientes];

        // 1. FILTRO POR PESTAÑA
        if (filtro !== 'TODOS') {
            if (filtro === 'ALERTA') data = data.filter(c => c.crm_intent === 'OPERATIONAL_ALERT');
            else if (filtro === 'ADMIN') data = data.filter(c => c.crm_intent === 'ADMIN_TASK');
            else data = data.filter(c => c.prioridad_visual === filtro);
        }

        // 2. FILTRO POR BÚSQUEDA (Nombre o Teléfono)
        if (busqueda) {
            const lowerTerm = busqueda.toLowerCase();
            data = data.filter(c =>
                (c.nombre_completo && c.nombre_completo.toLowerCase().includes(lowerTerm)) ||
                (c.telefono && c.telefono.includes(lowerTerm))
            );
        }

        // 3. ORDENAMIENTO
        data.sort((a, b) => {
            let valA = a[orden.key];
            let valB = b[orden.key];

            // Manejo de nulos
            if (!valA) valA = '';
            if (!valB) valB = '';

            // Manejo de fechas para ordenamiento correcto
            if (['last_interaction', 'next_follow_up_date'].includes(orden.key)) {
                valA = new Date(valA || 0).getTime();
                valB = new Date(valB || 0).getTime();
            }

            if (valA < valB) return orden.direction === 'asc' ? -1 : 1;
            if (valA > valB) return orden.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [clientes, filtro, busqueda, orden]);

    // 4. PAGINACIÓN
    const totalPaginas = Math.ceil(datosProcesados.length / itemsPorPagina);
    const datosPaginados = datosProcesados.slice(
        (paginaActual - 1) * itemsPorPagina,
        paginaActual * itemsPorPagina
    );

    // --- HELPERS VISUALES ---
    const getBadgeInfo = (intent, prioridadVisual) => {
        switch (intent) {
            case 'OPERATIONAL_ALERT': return { class: 'badge-alert', label: '🚨 ALERTA' };
            case 'ADMIN_TASK': return { class: 'badge-admin', label: '📄 TRAMITE' };
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

    const countAlerts = clientes.filter(c => c.crm_intent === 'OPERATIONAL_ALERT').length;
    const countAdmin = clientes.filter(c => c.crm_intent === 'ADMIN_TASK').length;

    // Icono de ordenamiento
    const SortIcon = ({ column }) => {
        if (orden.key !== column) return <span style={{ opacity: 0.3 }}>↕</span>;
        return orden.direction === 'asc' ? '⬆' : '⬇';
    };

    return (
        <div className="crm-container">
            {/* HEADER */}
            <header className="crm-header">
                <div>
                    <h1>🧠 Cerebro CRM</h1>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                        {clientes.length} Clientes Totales | Mostrando {datosProcesados.length}
                    </p>
                </div>

                <div className="crm-controls-group">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="🔍 Buscar nombre o teléfono..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                    <button onClick={cargarDatos} className="refresh-btn" title="Recargar Datos">🔄</button>
                </div>
            </header>

            {/* BARRA DE FILTROS (TABS) */}
            <div className="crm-tabs">
                {countAlerts > 0 && (
                    <button onClick={() => setFiltro('ALERTA')} className={`tab-btn alert ${filtro === 'ALERTA' ? 'active' : ''}`}>
                        🚨 ALERTAS ({countAlerts})
                    </button>
                )}
                <button onClick={() => setFiltro('ADMIN')} className={`tab-btn admin ${filtro === 'ADMIN' ? 'active' : ''}`}>
                    📄 Tramites ({countAdmin})
                </button>
                <div className="divider-vertical"></div>
                <button onClick={() => setFiltro('TODOS')} className={`tab-btn ${filtro === 'TODOS' ? 'active' : ''}`}>Todos</button>
                <button onClick={() => setFiltro('CITA')} className={`tab-btn ${filtro === 'CITA' ? 'active' : ''}`}>📅 Citas</button>
                <button onClick={() => setFiltro('ATENCION')} className={`tab-btn ${filtro === 'ATENCION' ? 'active' : ''}`}>🔥 Atención</button>
            </div>

            {/* TABLA */}
            {loading ? <div className="loading-state">Analizando base de datos...</div> : (
                <div className="crm-table-wrapper">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('nombre_completo')} className="sortable">
                                    Cliente <SortIcon column="nombre_completo" />
                                </th>
                                <th onClick={() => handleSort('crm_intent')} className="sortable">
                                    Estado <SortIcon column="crm_intent" />
                                </th>
                                <th onClick={() => handleSort('last_interaction')} className="sortable">
                                    Último Msj <SortIcon column="last_interaction" />
                                </th>
                                <th>Análisis IA</th>
                                <th onClick={() => handleSort('next_follow_up_date')} className="sortable">
                                    Próx. Acción <SortIcon column="next_follow_up_date" />
                                </th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datosPaginados.length > 0 ? datosPaginados.map(cliente => {
                                const badge = getBadgeInfo(cliente.crm_intent, cliente.prioridad_visual);

                                return (
                                    <tr key={cliente.cliente_id} className={cliente.crm_intent === 'OPERATIONAL_ALERT' ? 'row-alert' : ''}>
                                        {/* 1. Cliente */}
                                        <td>
                                            <div className="client-info">
                                                <strong>{cliente.nombre_completo || 'Desconocido'}</strong>
                                                <span className="phone">{cliente.telefono}</span>
                                                {cliente.saldo_pendiente > 0 && (
                                                    <span className="debt-badge">Debe: ${cliente.saldo_pendiente}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 2. Estado */}
                                        <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>

                                        {/* 3. Último Msj */}
                                        <td className="msg-cell">
                                            <div className={`msg-bubble ${cliente.ultimo_mensaje_rol === 'assistant' ? 'assistant' : 'user'}`}>
                                                {cliente.ultimo_mensaje_texto || '(Sin mensajes)'}
                                            </div>
                                            <div className="time">
                                                {cliente.last_interaction
                                                    ? new Date(cliente.last_interaction).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : ''}
                                            </div>
                                        </td>

                                        {/* 4. IA Summary */}
                                        <td style={{ maxWidth: '220px' }}>
                                            <p className="ai-summary">{cliente.ai_summary || cliente.razon_ia || '...'}</p>
                                        </td>

                                        {/* 5. Próxima Acción */}
                                        <td>
                                            {cliente.next_follow_up_date ? (
                                                <div className="follow-up">
                                                    📅 {new Date(cliente.next_follow_up_date).toLocaleDateString()}
                                                    <br />
                                                    ⏰ {new Date(cliente.next_follow_up_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            ) : (
                                                <span className="dash">-</span>
                                            )}
                                        </td>

                                        {/* 6. Botones */}
                                        <td>
                                            <div className="actions">
                                                <button className="action-btn chat-btn" onClick={() => setSelectedClientForChat(cliente)}>💬</button>
                                                <button className="action-btn ai-btn" onClick={() => handleAnalizar(cliente.cliente_id)}>⚡</button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                                        No se encontraron resultados para "{busqueda}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* PAGINACIÓN */}
            {!loading && (
                <div className="pagination">
                    <button
                        disabled={paginaActual === 1}
                        onClick={() => setPaginaActual(p => p - 1)}
                    >
                        ◀ Anterior
                    </button>
                    <span>Página {paginaActual} de {totalPaginas || 1}</span>
                    <button
                        disabled={paginaActual === totalPaginas || totalPaginas === 0}
                        onClick={() => setPaginaActual(p => p + 1)}
                    >
                        Siguiente ▶
                    </button>
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