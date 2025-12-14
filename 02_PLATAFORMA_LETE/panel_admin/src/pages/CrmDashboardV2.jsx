import React, { useEffect, useState, useMemo } from 'react';
// Importamos la versión 2 de la API
import { getCrmDashboardV2 } from '../apiService';
import ChatModal from '../components/ChatModal';
import './CrmDashboard.css';
// Importamos los íconos (asumiendo que usas Font Awesome o similar)
import { FaSyncAlt, FaMoneyBillWave, FaClock, FaCalendarCheck, FaExclamationTriangle, FaTimesCircle, FaCheckCircle, FaUserTag, FaHandPointRight } from 'react-icons/fa';
import { IoChatbubbleEllipsesSharp } from 'react-icons/io5';

const CrmDashboardV2 = () => {
    // --- ESTADOS DE DATOS ---\
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [modalAbierto, setModalAbierto] = useState(null); // Para futuros modales de Acción

    // --- ESTADOS DE INTERFAZ ---\
    const [filtro, setFiltro] = useState('TODOS');
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState({ key: 'status_integridad', direction: 'asc' }); // Ordenamos por Integridad por defecto
    const [paginaActual, setPaginaActual] = useState(1);
    const itemsPorPagina = 20;

    const [selectedClientForChat, setSelectedClientForChat] = useState(null);

    // --- CARGA DE DATOS (Usando V2) ---\
    const cargarDatos = async () => {
        setLoading(true);
        try {
            // Llama a la nueva función
            const data = await getCrmDashboardV2();
            setClientes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error cargando CRM V2:", error);
            setClientes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    // --- LÓGICA DE FILTRADO Y ORDENAMIENTO (Adaptada a la nueva estructura) ---
    const clientesFiltrados = useMemo(() => {
        let clientesFiltro = clientes;

        // 1. Filtrado por Búsqueda (en nombre, teléfono o intent)
        if (busqueda) {
            const lowerBusqueda = busqueda.toLowerCase();
            clientesFiltro = clientesFiltro.filter(c =>
                c.nombre_completo?.toLowerCase().includes(lowerBusqueda) ||
                c.telefono?.includes(busqueda) ||
                c.crm_intent?.toLowerCase().includes(lowerBusqueda) ||
                c.mensaje_integridad?.toLowerCase().includes(lowerBusqueda)
            );
        }

        // 2. Ordenamiento
        const factor = orden.direction === 'asc' ? 1 : -1;
        clientesFiltro.sort((a, b) => {
            const aVal = a[orden.key];
            const bVal = b[orden.key];

            // Ordenamiento por Integridad (Priorizar errores)
            if (orden.key === 'status_integridad') {
                const map = { 'ERROR_GHOST': 1, 'MANUAL': 2, 'OK': 3 };
                return (map[aVal] - map[bVal]) * factor;
            }

            // Lógica de ordenamiento general (adaptada)
            if (aVal < bVal) return -1 * factor;
            if (aVal > bVal) return 1 * factor;
            return 0;
        });

        return clientesFiltro;
    }, [clientes, busqueda, orden]);

    // --- PAGINACIÓN ---
    const totalPaginas = Math.ceil(clientesFiltrados.length / itemsPorPagina);
    const datosPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * itemsPorPagina;
        return clientesFiltrados.slice(inicio, inicio + itemsPorPagina);
    }, [clientesFiltrados, paginaActual]);

    // --- LÓGICA DE RENDERING ---

    // Función para renderizar el semáforo de Integridad
    const renderIntegridadStatus = (cliente) => {
        const { status_integridad, cita_real, mensaje_integridad } = cliente;

        switch (status_integridad) {
            case 'ERROR_GHOST':
                return (
                    <div className="status-badge critical" title="IA detectó cita, pero no está en MariaDB">
                        <FaTimesCircle /> {mensaje_integridad}
                    </div>
                );
            case 'MANUAL':
                return (
                    <div className="status-badge warning" title="Agendado en MariaDB sin paso previo por IA/Bot">
                        <FaExclamationTriangle /> {mensaje_integridad}
                    </div>
                );
            case 'OK':
            default:
                return (
                    <div className="status-badge success" title={cita_real ? `Agendado: ${new Date(cita_real.fecha).toLocaleDateString()}` : 'Lead en Proceso'}>
                        <FaCheckCircle /> {cita_real ? 'Sincronizado' : 'Lead OK'}
                    </div>
                );
        }
    };

    // Función para renderizar el estado financiero
    const renderFinanzasStatus = (finanzas) => {
        const porcentaje = finanzas.total_cotizado > 0
            ? Math.min(100, (finanzas.total_pagado / finanzas.total_cotizado) * 100)
            : 0;

        const colorBarra = porcentaje === 100 ? '#4caf50' : (porcentaje > 0 ? '#ff9800' : '#f44336');

        return (
            <div className="finance-status">
                <div className="progress-bar-container" title={`$${finanzas.total_pagado.toFixed(2)} pagado de $${finanzas.total_cotizado.toFixed(2)} cotizado`}>
                    <div className="progress-bar" style={{ width: `${porcentaje}%`, backgroundColor: colorBarra }}></div>
                </div>
                <small>Pendiente: **${finanzas.saldo_pendiente.toFixed(2)}**</small>
            </div>
        );
    };

    // Placeholder para la acción de agendar (Fase 5)
    const handleAction = (cliente, action) => {
        if (action === 'AGENDAR_AHORA') {
            alert(`Acción: Agendar a ${cliente.nombre_completo}. (Implementación en Fase 5)`);
            // Aquí iría el modal o la llamada API
        } else if (action === 'VER_DETALLES') {
            setSelectedClientForChat(cliente);
        }
    }

    return (
        <div className="crm-dashboard-container">
            <h2><FaSyncAlt /> Centro de Comando CRM V2 (Doble Cruce de Verdad)</h2>

            {/* BARRA DE FILTROS Y BÚSQUEDA (Mantenemos tu diseño) */}
            <div className="crm-controls">
                <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono o intent..."
                    value={busqueda}
                    onChange={(e) => {
                        setBusqueda(e.target.value);
                        setPaginaActual(1);
                    }}
                    className="search-input"
                />
                <button onClick={cargarDatos} className="tab-btn refresh-btn">
                    Recargar Datos
                </button>
            </div>

            {/* TABLA PRINCIPAL */}
            {loading ? (
                <div className="loading-state">Cargando la verdad del negocio...</div>
            ) : (
                <div className="crm-table-wrapper">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th onClick={() => setOrden({ key: 'nombre_completo', direction: orden.key === 'nombre_completo' && orden.direction === 'asc' ? 'desc' : 'asc' })}>
                                    Cliente / Teléfono
                                </th>
                                <th onClick={() => setOrden({ key: 'status_integridad', direction: orden.key === 'status_integridad' && orden.direction === 'asc' ? 'desc' : 'asc' })}>
                                    <FaSyncAlt /> Integridad Agenda
                                </th>
                                <th>
                                    <FaCalendarCheck /> Agenda Real (MariaDB)
                                </th>
                                <th>
                                    <FaUserTag /> Técnico Asignado
                                </th>
                                <th>
                                    <FaMoneyBillWave /> Estado Financiero
                                </th>
                                <th>
                                    <FaClock /> Última Interacción IA
                                </th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datosPaginados.map((cliente) => {
                                // Buscamos el caso más reciente si existe
                                const casoReciente = cliente.casos ? cliente.casos[cliente.casos.length - 1] : null;

                                return (
                                    <tr key={cliente.id}>
                                        {/* Columna 1: Cliente */}
                                        <td>
                                            <strong>{cliente.nombre_completo || 'N/A'}</strong>
                                            <small>{cliente.telefono}</small>
                                            <div className="status-badge intent-badge" title="Intención detectada por la IA">
                                                {cliente.crm_intent || 'LEAD (Sin IA)'}
                                            </div>
                                        </td>

                                        {/* Columna 2: INTEGRIDAD (NUEVA) */}
                                        <td className="integrity-status-cell">
                                            {renderIntegridadStatus(cliente)}
                                        </td>

                                        {/* Columna 3: AGENDA REAL (NUEVA) */}
                                        <td>
                                            {cliente.cita_real ? (
                                                <>
                                                    {new Date(cliente.cita_real.fecha).toLocaleString()}
                                                    <small>ID Cita: {cliente.cita_real.id_cita}</small>
                                                </>
                                            ) : 'No Agendado'}
                                        </td>

                                        <td>
                                            {cliente.cita_real?.tecnico || cliente.tecnico_caso_supa || 'Pendiente'}
                                        </td>

                                        {/* Columna 5: FINANZAS (NUEVA) */}
                                        <td>
                                            {renderFinanzasStatus(cliente.finanzas)}
                                        </td>

                                        {/* Columna 6: Última Interacción */}
                                        <td>
                                            {cliente.last_interaction ? new Date(cliente.last_interaction).toLocaleString() : 'N/A'}
                                            <small>{cliente.ai_summary}</small>
                                        </td>

                                        {/* Columna 7: ACCIONES */}
                                        <td>
                                            <button
                                                className={`action-btn chat-btn ${cliente.status_integridad === 'ERROR_GHOST' ? 'primary-action' : ''}`}
                                                onClick={() => handleAction(cliente, cliente.accion_sugerida)}
                                                title={cliente.status_integridad === 'ERROR_GHOST' ? "Usar datos de IA para crear cita real" : "Ver detalles y chatear"}
                                            >
                                                {cliente.status_integridad === 'ERROR_GHOST' ? <FaHandPointRight /> : <IoChatbubbleEllipsesSharp />}
                                                {' '}{cliente.status_integridad === 'ERROR_GHOST' ? 'Fix Agenda' : 'Chat'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {datosPaginados.length === 0 && (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                        No se encontraron resultados para los filtros actuales.
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
                    <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className="tab-btn">◀ Anterior</button>
                    <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>Página {paginaActual} de {totalPaginas || 1}</span>
                    <button disabled={paginaActual === totalPaginas || totalPaginas === 0} onClick={() => setPaginaActual(p => p + 1)} className="tab-btn">Siguiente ▶</button>
                </div>
            )}

            {/* MODALES */}
            {selectedClientForChat && (
                <ChatModal
                    cliente={selectedClientForChat}
                    onClose={() => setSelectedClientForChat(null)}
                />
            )}

            {/* Aquí irían los modales de Agendar y Cierre Forzoso (Fase 5) */}
        </div>
    );
};

export default CrmDashboardV2;