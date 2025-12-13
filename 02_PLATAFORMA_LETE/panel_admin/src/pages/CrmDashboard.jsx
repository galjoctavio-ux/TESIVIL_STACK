import React, { useEffect, useState, useMemo } from 'react';
import { getCrmDashboard, forceAnalyze } from '../apiService';
import ChatModal from '../components/ChatModal';
import './CrmDashboard.css';

// --- FUNCIONES DE AYUDA VISUAL ---

// Función para el semáforo de Calificación del Cliente
const getStatusColor = (calificacion) => {
    switch (calificacion) {
        case 'SOSPECHOSO': return 'var(--red-500)';
        case 'HOSTIL': return 'var(--red-500)';
        case 'NEUTRO': return 'var(--yellow-500)';
        case 'AMABLE': return 'var(--green-500)';
        default: return 'var(--gray-400)';
    }
};

// Componente para los círculos de sincronización y alertas
const renderSyncStatus = (cliente) => {
    const status = [];

    // 1. Estado MariaDB (Easy!Appointments)
    const mariaDBColor = cliente.sync_mariadb ? 'var(--green-500)' : 'var(--red-500)';
    status.push(
        <span key="ea" title={cliente.sync_mariadb ? "Usuario en Easy!Appointments" : "Falta crear en EA"} style={{ color: mariaDBColor }}>
            ● EA
        </span>
    );

    // 2. Estado Evolution (WhatsApp/CRM)
    const evolutionColor = cliente.sync_evolution ? 'var(--green-500)' : 'var(--gray-400)';
    status.push(
        <span key="ev" title={cliente.sync_evolution ? "Sincronizado con WhatsApp (Evolution)" : "Sin historial de Evolution"} style={{ color: evolutionColor }}>
            ● WA
        </span>
    );

    // 3. Alerta de Cita Desincronizada (Si IA dijo CITA pero no hay registro en EA)
    if (cliente.alerta_cita_desincronizada) {
        status.push(
            <span key="cita" title="¡ALERTA! Cliente con intención de CITA pero no agendado en EA." style={{ color: 'var(--red-500)', fontWeight: 'bold' }}>
                ⚠️ CITA
            </span>
        );
    }

    // 4. Bandera de Cotización Pendiente
    if (cliente.debe_cotizacion) {
        status.push(
            <span key="cotiz" title="Requiere cotización pendiente de generar o enviar." style={{ color: 'var(--blue-500)', fontWeight: 'bold' }}>
                💰 COT. PENDIENTE
            </span>
        );
    }

    return status.map((s, index) => (
        <React.Fragment key={index}>
            {s}{index < status.length - 1 && ' | '}
        </React.Fragment>
    ));
};

/**
 * Función de seguridad para manejar textos que pueden ser nulos y cortarlos.
 */
const safeText = (text, limit = 100) => {
    if (!text) return '...';
    // Nos aseguramos que sea un string antes de cortar
    const str = String(text);
    return str.length > limit ? str.substring(0, limit) + '...' : str;
};


// --- COMPONENTE PRINCIPAL ---

const CrmDashboard = () => {
    // --- ESTADOS DE DATOS ---
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- ESTADOS DE INTERFAZ ---
    const [filtro, setFiltro] = useState('TODOS');
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState({ key: 'last_interaction', direction: 'desc' });
    const [paginaActual, setPaginaActual] = useState(1);
    const itemsPorPagina = 20;

    const [selectedClientForChat, setSelectedClientForChat] = useState(null);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const data = await getCrmDashboard();
            // Manejamos el caso de que data no sea un array
            setClientes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error cargando CRM:", error);
            setClientes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    // --- LÓGICA DE FILTRADO Y ORDENAMIENTO (useMemo) ---
    const clientesFiltrados = useMemo(() => {
        let resultados = [...clientes]; // Usar copia segura

        // 1. Aplicar filtro de búsqueda de texto
        if (busqueda) {
            const lowerBusqueda = busqueda.toLowerCase();
            resultados = resultados.filter(cliente =>
                (cliente.nombre_completo || '').toLowerCase().includes(lowerBusqueda) ||
                (cliente.telefono || '').includes(lowerBusqueda) ||
                (cliente.ai_summary || '').toLowerCase().includes(lowerBusqueda) ||
                (cliente.crm_status || '').toLowerCase().includes(lowerBusqueda)
            );
        }

        // 2. Aplicar filtro de pestaña (TODOS, ALERTA, etc.)
        if (filtro === 'ALERTA') {
            resultados = resultados.filter(cliente =>
                cliente.debe_cotizacion ||
                cliente.alerta_cita_desincronizada ||
                cliente.crm_intent === 'QUOTE_FOLLOWUP'
            );
        } else if (filtro !== 'TODOS') {
            // Se puede agregar lógica para otros filtros si se definen más pestañas
        }


        // 3. Aplicar ordenamiento
        resultados.sort((a, b) => {
            const aVal = a[orden.key];
            const bVal = b[orden.key];

            // Manejo de valores nulos o indefinidos
            if (aVal === undefined || aVal === null) return orden.direction === 'asc' ? -1 : 1;
            if (bVal === undefined || bVal === null) return orden.direction === 'asc' ? 1 : -1;

            // Comparación de fechas o strings
            if (aVal < bVal) return orden.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return orden.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return resultados;
    }, [clientes, busqueda, orden, filtro]);

    // --- LÓGICA DE PAGINACIÓN ---
    const totalPaginas = Math.ceil(clientesFiltrados.length / itemsPorPagina);
    const clientesPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        return clientesFiltrados.slice(inicio, fin);
    }, [clientesFiltrados, paginaActual, itemsPorPagina]);

    useEffect(() => {
        setPaginaActual(1);
    }, [filtro, busqueda]);


    // Función de encabezado de tabla para manejar el ordenamiento
    const handleSort = (key) => {
        if (orden.key === key) {
            setOrden(prev => ({
                key,
                direction: prev.direction === 'asc' ? 'desc' : 'asc'
            }));
        } else {
            setOrden({ key, direction: 'desc' });
        }
    };

    // Renderiza el ícono de ordenamiento
    const renderSortIndicator = (key) => {
        if (orden.key === key) {
            return orden.direction === 'asc' ? '▲' : '▼';
        }
        return '';
    };

    return (
        <div className="crm-dashboard">
            <h2>📊 CRM: Fuente de la Verdad</h2>
            <p>Datos en tiempo real cruzados entre WhatsApp (Evolution), Supabase y Agenda (MariaDB).</p>

            <div className="controls">
                {/* PESTAÑAS DE FILTRO */}
                <div className="filter-tabs">
                    {['TODOS', 'ALERTA', 'PENDIENTE', 'FOLLOWUP'].map(f => (
                        <button
                            key={f}
                            className={filtro === f ? 'active' : ''}
                            onClick={() => setFiltro(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* BUSCADOR */}
                <input
                    type="text"
                    placeholder="Buscar por Nombre, Teléfono o Resumen..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="search-input"
                />
            </div>

            {loading ? (
                <div className="loading-spinner">Cargando datos...</div>
            ) : (
                <div className="table-wrapper">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('last_interaction')}>
                                    Última Interacción {renderSortIndicator('last_interaction')}
                                </th>
                                <th>Datos del Cliente</th>
                                <th>AI Summary (Intent)</th>
                                <th>Status Operativo</th>
                                <th onClick={() => handleSort('unread_count')}>
                                    No Leídos {renderSortIndicator('unread_count')}
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientesPaginados.length > 0 ? clientesPaginados.map(cliente => (
                                <tr key={cliente.id}>
                                    {/* 1. Última Interacción */}
                                    <td>
                                        {cliente.last_interaction ? new Date(cliente.last_interaction).toLocaleString('es-MX', {
                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                        }) : '-'}
                                        <div style={{ fontSize: '0.8em', color: getStatusColor(cliente.calificacion_semaforo) }}>
                                            ● {cliente.calificacion_semaforo || 'N/A'}
                                        </div>
                                    </td>

                                    {/* 2. Datos del Cliente */}
                                    <td>
                                        <strong>{cliente.nombre_completo || 'N/A'}</strong><br />
                                        <span style={{ color: 'var(--gray-600)' }}>Tel: {cliente.telefono || 'N/A'}</span>
                                        {cliente.direccion_real && (
                                            <div style={{ marginTop: '0.25rem' }}>
                                                {cliente.direccion_real}
                                                {cliente.mapa_link && (
                                                    <a href={cliente.mapa_link} target="_blank" rel="noopener noreferrer"
                                                        title="Ver en Google Maps" style={{ marginLeft: '0.5rem', color: 'var(--blue-500)' }}>
                                                        (Mapa 🗺️)
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {(cliente.saldo_pendiente > 0) && (
                                            <div style={{ color: 'var(--red-500)', fontWeight: 'bold' }}>
                                                Saldo Pndte: ${Number(cliente.saldo_pendiente).toFixed(2)}
                                            </div>
                                        )}
                                    </td>

                                    {/* 3. AI Summary (Intent) - CORREGIDO */}
                                    <td>
                                        <div className={`crm-status-badge status-${cliente.crm_status || 'NONE'}`}>
                                            {cliente.crm_status || 'NONE'}
                                        </div>
                                        <div className="ai-summary-text" title={safeText(cliente.ai_summary, 500)}>
                                            {safeText(cliente.ai_summary)}
                                        </div>
                                    </td>

                                    {/* 4. STATUS OPERATIVO (Nuevo) */}
                                    <td>
                                        {renderSyncStatus(cliente)}
                                    </td>

                                    {/* 5. No Leídos */}
                                    <td style={{ textAlign: 'center' }}>
                                        {cliente.unread_count > 0 ? (
                                            <span className="unread-count-badge">{cliente.unread_count}</span>
                                        ) : ('0')}
                                    </td>

                                    {/* 6. Acciones */}
                                    <td>
                                        <button
                                            className="action-button chat-button"
                                            onClick={() => setSelectedClientForChat(cliente)}
                                        >
                                            Chat 💬
                                        </button>
                                        <button
                                            className="action-button analyze-button"
                                            onClick={() => forceAnalyze(cliente.id).then(cargarDatos)}
                                        >
                                            Force AI 🤖
                                        </button>
                                    </td>
                                </tr>
                            )) : (
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