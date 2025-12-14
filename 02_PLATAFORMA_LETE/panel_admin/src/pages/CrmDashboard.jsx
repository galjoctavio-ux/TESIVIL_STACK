import React, { useEffect, useState, useMemo } from 'react';
// Importamos la instancia de api (axios) y forceAnalyze (acción operativa)
import api, { forceAnalyze } from '../apiService';
import ChatModal from '../components/ChatModal';
import ClientCard from '../components/ClientCard'; // <-- EL NUEVO COMPONENTE DE VISTA
import './CrmDashboard.css'; // Usamos el CSS existente

// Función para obtener los datos V2 de auditoría
const getCrmDashboardV2 = async () => {
    // Asumimos que este es el nuevo endpoint que retorna el campo status_integridad
    const response = await api.get('/clientes/dashboard-v2');
    // Manejamos la respuesta, esperando que 'data' contenga el array de clientes
    return response.data.data || response.data;
};


const CrmDashboard = () => {
    // --- ESTADOS DE DATOS ---
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- ESTADOS DE INTERFAZ (Restaurados de V1) ---
    // El filtro ahora se basa en el status_integridad
    const [filtro, setFiltro] = useState('TODOS');
    const [busqueda, setBusqueda] = useState('');
    // Ordenamiento dinámico
    const [orden, setOrden] = useState({ key: 'last_interaction', direction: 'desc' });
    const [paginaActual, setPaginaActual] = useState(1);
    const itemsPorPagina = 20;

    const [selectedClientForChat, setSelectedClientForChat] = useState(null);

    // --- CARGA DE DATOS ---
    const cargarDatos = async () => {
        setLoading(true);
        try {
            const data = await getCrmDashboardV2();
            setClientes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error cargando Centro de Mando CRM V2:", error);
            setClientes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    // Resetear paginación al filtrar/buscar
    useEffect(() => { setPaginaActual(1); }, [filtro, busqueda]);


    // --- CALCULOS DE CONTADORES (Adaptados a V2) ---
    const counts = useMemo(() => {
        return {
            total: clientes.length,
            // Alerta: Es la combinación de Fantasma y Manual (requieren atención)
            alertas: clientes.filter(c => c.status_integridad !== 'OK').length,
            citasFantasma: clientes.filter(c => c.status_integridad === 'ERROR_GHOST').length,
            manuales: clientes.filter(c => c.status_integridad === 'MANUAL').length
        };
    }, [clientes]);

    // --- LÓGICA DE FILTRADO, BÚSQUEDA Y ORDENACIÓN (Restaurada y adaptada) ---
    const datosFiltrados = useMemo(() => {
        let datos = [...clientes];

        // 1. Filtrar por estado de integridad (V2)
        if (filtro === 'ALERTA') {
            // Unificamos las alertas que requieren revisión manual
            datos = datos.filter(c => c.status_integridad === 'ERROR_GHOST' || c.status_integridad === 'MANUAL');
        } else if (filtro === 'ERROR_GHOST' || filtro === 'MANUAL' || filtro === 'OK') {
            datos = datos.filter(c => c.status_integridad === filtro);
        }

        // 2. Búsqueda por texto (retained from V1)
        if (busqueda.trim() !== '') {
            const query = busqueda.toLowerCase().trim();
            datos = datos.filter(c =>
                c.nombre_completo?.toLowerCase().includes(query) ||
                c.telefono?.includes(query) ||
                c.ai_summary?.toLowerCase().includes(query) ||
                c.notas_internas?.toLowerCase().includes(query)
            );
        }

        // 3. Ordenar (V1 logic restored)
        datos.sort((a, b) => {
            let valA = a[orden.key];
            let valB = b[orden.key];

            if (['last_interaction', 'next_follow_up_date'].includes(orden.key)) {
                // Convertir fechas a milisegundos para ordenar
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else {
                // Ordenamiento alfabético
                valA = valA ? String(valA).toLowerCase() : '';
                valB = valB ? String(valB).toLowerCase() : '';
            }

            // Aplicar dirección
            if (valA < valB) return orden.direction === 'asc' ? -1 : 1;
            if (valA > valB) return orden.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return datos;
    }, [clientes, filtro, busqueda, orden]);

    // --- ACCIONES (Restauradas de V1 y adaptadas a V2) ---
    const handleSort = (key) => {
        setOrden(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleForceAnalyze = async (id) => {
        if (!window.confirm("¿Forzar análisis de IA para este cliente?")) return;
        try {
            await forceAnalyze(id);
            alert("Solicitud enviada. Recargando datos en 3s...");
            setTimeout(cargarDatos, 3000);
        } catch (error) {
            alert("Error al solicitar análisis.");
        }
    };

    // La acción unificada que maneja el click en la tarjeta o botones internos
    const handleCardAction = (cliente, actionType) => {
        const id = cliente.id || cliente.cliente_id;

        if (actionType === 'OPEN_CHAT') {
            setSelectedClientForChat(cliente);
        } else if (actionType === 'FORCE_ANALYZE') {
            handleForceAnalyze(id);
        } else if (actionType === 'REVISAR_GHOST') {
            alert(`⚠️ DISCREPANCIA (Cita Fantasma) para ${cliente.nombre_completo}.\n\nEl sistema detectó intención de cita pero NO se encontró el registro vinculado en la Agenda.\n\nACCIÓN: Debe crear el Caso/Cita manualmente para sincronizar.`);
        } else if (actionType === 'REVISAR_MANUAL') {
            alert(`⚠️ CLIENTE AGENDADO MANUALMENTE para ${cliente.nombre_completo}.\n\nEl sistema no pudo detectar un flujo de chat completo. Revisar la conversación y cerrar el caso si es necesario.`);
        } else {
            // Por defecto, si no hay acción específica, abrir el chat.
            setSelectedClientForChat(cliente);
        }
    }


    // --- LÓGICA DE PAGINACIÓN ---
    const totalPaginas = Math.ceil(datosFiltrados.length / itemsPorPagina);
    const datosPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        return datosFiltrados.slice(inicio, fin);
    }, [datosFiltrados, paginaActual, itemsPorPagina]);

    // Asegurar que la paginación no se salga de rango
    useEffect(() => {
        if (paginaActual > totalPaginas && totalPaginas > 0) {
            setPaginaActual(totalPaginas);
        } else if (paginaActual === 0 && totalPaginas > 0) {
            setPaginaActual(1);
        }
    }, [totalPaginas, paginaActual]);

    // --- RENDERIZADO ---
    return (
        <div className="crm-container">
            {/* HEADER */}
            <header className="crm-header">
                <div>
                    <h1>🧠 Centro de Mando CRM V2 (Doble Cruce de Verdad)</h1>
                    <div className="crm-stats">
                        Total: {counts.total} |
                        🚨 Alertas (Fantasma/Manual): <span style={{ color: 'red', fontWeight: 'bold' }}>{counts.alertas}</span> |
                        👻 Citas Fantasma: {counts.citasFantasma}
                    </div>
                </div>

                <div className="crm-controls-group">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="🔍 Buscar por nombre, teléfono, resumen IA..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                    <button onClick={cargarDatos} className="refresh-btn" title="Recargar">🔄</button>
                </div>
            </header>

            {/* BARRA DE FILTROS (Adaptada a V2 status_integridad) */}
            <div className="crm-tabs">
                <button
                    onClick={() => setFiltro('ALERTA')}
                    className={`tab-btn alert ${filtro === 'ALERTA' ? 'active' : ''}`}
                >
                    🚨 ALERTAS ({counts.alertas})
                </button>
                <button
                    onClick={() => setFiltro('ERROR_GHOST')}
                    className={`tab-btn alert ${filtro === 'ERROR_GHOST' ? 'active' : ''}`}
                >
                    👻 Cita Fantasma ({counts.citasFantasma})
                </button>
                <button
                    onClick={() => setFiltro('MANUAL')}
                    className={`tab-btn manual ${filtro === 'MANUAL' ? 'active' : ''}`}
                >
                    ⚠️ Agendado Manual ({counts.manuales})
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
                    Todos ({counts.total})
                </button>
            </div>

            {/* OPCIONES DE ORDENAMIENTO (Restauradas de V1) */}
            <div className="crm-sort-options">
                Ordenar por:
                <button onClick={() => handleSort('last_interaction')} className={`sort-btn ${orden.key === 'last_interaction' ? 'active' : ''}`}>
                    Última Interacción {orden.key === 'last_interaction' ? (orden.direction === 'desc' ? '🔽' : '🔼') : '↕'}
                </button>
                <button onClick={() => handleSort('saldo_pendiente')} className={`sort-btn ${orden.key === 'saldo_pendiente' ? 'active' : ''}`}>
                    Saldo Pendiente {orden.key === 'saldo_pendiente' ? (orden.direction === 'desc' ? '🔽' : '🔼') : '↕'}
                </button>
                <button onClick={() => handleSort('nombre_completo')} className={`sort-btn ${orden.key === 'nombre_completo' ? 'active' : ''}`}>
                    Nombre {orden.key === 'nombre_completo' ? (orden.direction === 'desc' ? '🔽' : '🔼') : '↕'}
                </button>
            </div>


            {/* CUERPO PRINCIPAL (GRID DE TARJETAS V2) */}
            {loading ? (
                <div className="loading-state">Analizando ecosistema de datos...</div>
            ) : datosPaginados.length === 0 ? (
                <div className="loading-state">No se encontraron clientes que cumplan los criterios.</div>
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
                    <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>Página {paginaActual} de {totalPaginas || 1}</span>
                    <button disabled={paginaActual === totalPaginas || totalPaginas === 0} onClick={() => setPaginaActual(p => p + 1)} className="tab-btn">Siguiente ▶</button>
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