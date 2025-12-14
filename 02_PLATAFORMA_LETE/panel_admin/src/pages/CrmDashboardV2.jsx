import React, { useEffect, useState, useMemo } from 'react';
import api, { forceAnalyze } from '../apiService';
import ChatModal from '../components/ChatModal';
import ClientCard from '../components/ClientCard';
import './CrmDashboard.css';

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

    // --- CARGA DE DATOS ---
    const cargarDatos = async () => {
        setLoading(true);
        try {
            // CORRECCIÓN CRÍTICA: La ruta correcta incluye 'admin-'
            const response = await api.get('/clientes/admin-dashboard-v2');

            // Verificamos la estructura de la respuesta (puede venir directa o anidada en data)
            const dataRaw = response.data.data || response.data;
            setClientes(Array.isArray(dataRaw) ? dataRaw : []);

        } catch (error) {
            console.error("Error cargando CRM V2 (Verifique ruta backend):", error);
            setClientes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
        // Auto-refresh cada 5 minutos
        const interval = setInterval(cargarDatos, 300000);
        return () => clearInterval(interval);
    }, []);

    // Resetear paginación al filtrar/buscar
    useEffect(() => { setPaginaActual(1); }, [filtro, busqueda]);

    // --- CALCULOS DE CONTADORES ---
    const counts = useMemo(() => {
        return {
            total: clientes.length,
            // Alerta Unificada: Fantasmas + Manuales (que requieren revisión)
            alertas: clientes.filter(c => c.status_integridad === 'ERROR_GHOST' || c.status_integridad === 'MANUAL').length,
            fantasmas: clientes.filter(c => c.status_integridad === 'ERROR_GHOST').length,
            manuales: clientes.filter(c => c.status_integridad === 'MANUAL').length,
            sincronizados: clientes.filter(c => c.status_integridad === 'OK').length
        };
    }, [clientes]);

    // --- LÓGICA DE FILTRADO, BÚSQUEDA Y ORDENAMIENTO ---
    const datosFiltrados = useMemo(() => {
        let datos = [...clientes];

        // 1. Filtrar por estado
        if (filtro === 'ALERTA') {
            datos = datos.filter(c => c.status_integridad === 'ERROR_GHOST' || c.status_integridad === 'MANUAL');
        } else if (filtro !== 'TODOS') {
            datos = datos.filter(c => c.status_integridad === filtro);
        }

        // 2. Búsqueda inteligente (Nombre, Teléfono, Resumen IA)
        if (busqueda.trim() !== '') {
            const query = busqueda.toLowerCase().trim();
            datos = datos.filter(c =>
                (c.nombre_completo || '').toLowerCase().includes(query) ||
                (c.telefono || '').includes(query) ||
                (c.ai_summary || '').toLowerCase().includes(query)
            );
        }

        // 3. Ordenamiento
        datos.sort((a, b) => {
            let valA = a[orden.key];
            let valB = b[orden.key];

            if (['last_interaction'].includes(orden.key)) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else if (orden.key === 'saldo_pendiente') {
                // Ordenar numéricamente por finanzas
                valA = a.finanzas?.saldo_pendiente || 0;
                valB = b.finanzas?.saldo_pendiente || 0;
            } else {
                valA = valA ? String(valA).toLowerCase() : '';
                valB = valB ? String(valB).toLowerCase() : '';
            }

            if (valA < valB) return orden.direction === 'asc' ? -1 : 1;
            if (valA > valB) return orden.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return datos;
    }, [clientes, filtro, busqueda, orden]);

    // --- PAGINACIÓN ---
    const totalPaginas = Math.ceil(datosFiltrados.length / itemsPorPagina);
    const datosPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * itemsPorPagina;
        return datosFiltrados.slice(inicio, inicio + itemsPorPagina);
    }, [datosFiltrados, paginaActual, itemsPorPagina]);

    // --- ACCIONES ---
    const handleSort = (key) => {
        setOrden(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleCardAction = (cliente, actionType) => {
        if (actionType === 'REVISAR_MANUAL' || actionType === 'ERROR_GHOST') {
            alert(`⚠️ CITA FANTASMA DETECTADA\n\nCliente: ${cliente.nombre_completo}\n\nLa IA detectó intención de cita, pero NO existe en la Agenda (MariaDB).\n\nSOLUCIÓN: Vaya a 'Crear Caso' y agende la cita manualmente para corregir esta discrepancia.`);
        } else {
            setSelectedClientForChat(cliente);
        }
    }

    // --- RENDERIZADO ---
    return (
        <div className="crm-container">
            {/* HEADER */}
            <header className="crm-header">
                <div>
                    <h1>🧠 Centro de Mando V2 (Auditoría)</h1>
                    <div className="crm-stats">
                        Total: <strong>{counts.total}</strong> |
                        🚨 Atención Requerida: <strong style={{ color: '#ef4444' }}>{counts.alertas}</strong> |
                        ✅ Sincronizados: <strong style={{ color: '#10b981' }}>{counts.sincronizados}</strong>
                    </div>
                </div>

                <div className="crm-controls-group">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="🔍 Buscar cliente, teléfono..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                    <button onClick={cargarDatos} className="refresh-btn" title="Recargar Datos">🔄</button>
                </div>
            </header>

            {/* BARRA DE PESTAÑAS (FILTROS) */}
            <div className="crm-tabs">
                <button
                    onClick={() => setFiltro('ALERTA')}
                    className={`tab-btn alert ${filtro === 'ALERTA' ? 'active' : ''}`}
                >
                    🚨 ALERTAS ({counts.alertas})
                </button>
                <button
                    onClick={() => setFiltro('ERROR_GHOST')}
                    className={`tab-btn ${filtro === 'ERROR_GHOST' ? 'active' : ''}`}
                >
                    👻 Fantasmas ({counts.fantasmas})
                </button>
                <button
                    onClick={() => setFiltro('MANUAL')}
                    className={`tab-btn manual ${filtro === 'MANUAL' ? 'active' : ''}`}
                >
                    ⚠️ Manuales ({counts.manuales})
                </button>
                <div style={{ width: '1px', background: '#e2e8f0', margin: '0 5px' }}></div>
                <button
                    onClick={() => setFiltro('OK')}
                    className={`tab-btn ${filtro === 'OK' ? 'active' : ''}`}
                >
                    ✅ Sincronizados
                </button>
                <button
                    onClick={() => setFiltro('TODOS')}
                    className={`tab-btn ${filtro === 'TODOS' ? 'active' : ''}`}
                >
                    Todos
                </button>
            </div>

            {/* OPCIONES DE ORDENAMIENTO */}
            <div className="crm-sort-options">
                <span style={{ fontSize: '0.85em', color: '#64748b', marginRight: '10px' }}>Ordenar por:</span>
                <button onClick={() => handleSort('last_interaction')} className={`sort-btn ${orden.key === 'last_interaction' ? 'active' : ''}`}>
                    Recientes {orden.key === 'last_interaction' ? (orden.direction === 'desc' ? '▼' : '▲') : ''}
                </button>
                <button onClick={() => handleSort('saldo_pendiente')} className={`sort-btn ${orden.key === 'saldo_pendiente' ? 'active' : ''}`}>
                    Deuda {orden.key === 'saldo_pendiente' ? (orden.direction === 'desc' ? '▼' : '▲') : ''}
                </button>
                <button onClick={() => handleSort('nombre_completo')} className={`sort-btn ${orden.key === 'nombre_completo' ? 'active' : ''}`}>
                    Nombre {orden.key === 'nombre_completo' ? (orden.direction === 'desc' ? '▼' : '▲') : ''}
                </button>
            </div>

            {/* GRID DE RESULTADOS (MODO TARJETAS) */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Auditando bases de datos (Supabase vs MariaDB)...</p>
                </div>
            ) : datosPaginados.length === 0 ? (
                <div className="loading-state">
                    <p>No se encontraron resultados para los filtros actuales.</p>
                </div>
            ) : (
                <div className="clientes-grid">
                    {datosPaginados.map(cliente => (
                        <ClientCard
                            key={cliente.id || cliente.cliente_id}
                            cliente={cliente}
                            onAction={handleCardAction}
                        />
                    ))}
                </div>
            )}

            {/* PAGINACIÓN */}
            {!loading && datosFiltrados.length > 0 && (
                <div className="pagination">
                    <button disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)} className="tab-btn">◀ Anterior</button>
                    <span style={{ margin: '0 15px', color: '#64748b', fontSize: '0.9em' }}>
                        Página {paginaActual} de {totalPaginas || 1}
                    </span>
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
        </div>
    );
};

export default CrmDashboard;