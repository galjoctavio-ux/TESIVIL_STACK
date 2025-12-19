import React, { useEffect, useState, useMemo } from 'react';
import api from '../apiService';
import './CrmDashboardV3.css';
import ClientDetailsDrawer from '../components/ClientDetailsDrawer';

const CrmDashboardV3 = () => {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('TODOS');
    const [busqueda, setBusqueda] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);

    // ESTADO DE ORDENAMIENTO (Por defecto: Mayor Urgencia/Peso)
    const [orden, setOrden] = useState({ key: 'peso', direction: 'desc' });

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const response = await api.get('/clientes/admin-dashboard-v3');
            const dataRaw = response.data.data || [];
            setClientes(dataRaw);
        } catch (error) {
            console.error("Error V3:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
        const interval = setInterval(cargarDatos, 60000); // 1 minuto para tiempo real
        return () => clearInterval(interval);
    }, []);

    // --- ORDENAMIENTO COMPLEJO ---
    const handleSort = (key) => {
        setOrden(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const datosProcesados = useMemo(() => {
        let datos = [...clientes];

        // 1. Filtrado
        if (filtro === 'URGENTE') {
            datos = datos.filter(c => c.situacion.peso >= 70 || c.unread_count > 0);
        } else if (filtro === 'GHOST') {
            datos = datos.filter(c => c.situacion.estado === 'ERROR_GHOST');
        } else if (filtro === 'FUTURO') {
            datos = datos.filter(c => c.situacion.tipo === 'AUTO_MSG_FUTURE');
        }

        if (busqueda) {
            const q = busqueda.toLowerCase();
            datos = datos.filter(c => c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q));
        }

        // 2. Ordenamiento
        datos.sort((a, b) => {
            let valA, valB;

            if (orden.key === 'peso') {
                valA = a.situacion.peso;
                valB = b.situacion.peso;
            } else if (orden.key === 'last_interaction') {
                valA = new Date(a.last_interaction).getTime();
                valB = new Date(b.last_interaction).getTime();
            } else if (orden.key === 'next_action') {
                // Si es nulo, lo mandamos al final
                valA = a.next_action_date ? new Date(a.next_action_date).getTime() : 9999999999999;
                valB = b.next_action_date ? new Date(b.next_action_date).getTime() : 9999999999999;
            }

            if (valA < valB) return orden.direction === 'asc' ? -1 : 1;
            if (valA > valB) return orden.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return datos;
    }, [clientes, filtro, busqueda, orden]);

    // --- RENDERIZADO ---
    return (
        <div className="v3-container">
            {/* HEADER */}
            <div className="v3-header">
                <h2>🔮 Centro de Inteligencia (V3.1)</h2>
                <div className="v3-stats">
                    <span>Total: <strong>{clientes.length}</strong></span>
                    <span>🔥 Acción Requerida: <strong style={{color: '#ef4444'}}>{clientes.filter(c => c.situacion.peso >= 70).length}</strong></span>
                </div>
                <div className="controls">
                    <button onClick={cargarDatos} className="refresh-btn">🔄</button>
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
            </div>

            {/* TABS INTELIGENTES */}
            <div className="v3-tabs">
                <button className={`v3-tab alert ${filtro === 'URGENTE' ? 'active' : ''}`} onClick={() => setFiltro('URGENTE')}>🔥 Urgentes / Hoy</button>
                <button className={`v3-tab ${filtro === 'TODOS' ? 'active' : ''}`} onClick={() => setFiltro('TODOS')}>Panorama Completo</button>
                <button className={`v3-tab ${filtro === 'FUTURO' ? 'active' : ''}`} onClick={() => setFiltro('FUTURO')}>📅 Programados</button>
                <button className={`v3-tab ${filtro === 'GHOST' ? 'active' : ''}`} onClick={() => setFiltro('GHOST')}>👻 Errores</button>
            </div>

            {/* TABLA ORACLE */}
            <div className="table-container">
                <table className="v3-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('peso')} style={{cursor: 'pointer'}}>
                                Prioridad {orden.key === 'peso' ? (orden.direction === 'desc' ? '▼' : '▲') : ''}
                            </th>
                            <th>Cliente</th>
                            <th>Intención IA</th>
                            <th onClick={() => handleSort('next_action')} style={{cursor: 'pointer'}}>
                                🤖 Próxima Acción {orden.key === 'next_action' ? (orden.direction === 'asc' ? '▲' : '▼') : ''}
                            </th>
                            <th onClick={() => handleSort('last_interaction')} style={{cursor: 'pointer'}}>
                                Último Chat {orden.key === 'last_interaction' ? (orden.direction === 'desc' ? '▼' : '▲') : ''}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {datosProcesados.map(c => (
                            <tr key={c.id} onClick={() => setSelectedClient(c)} className={c.unread_count > 0 ? 'row-unread' : ''}>
                                {/* 1. PRIORIDAD / ESTADO */}
                                <td>
                                    <span className={`badge badge-${c.situacion.color}`}>
                                        {c.situacion.label}
                                    </span>
                                    {c.unread_count > 0 && <span className="badge-unread">+{c.unread_count}</span>}
                                </td>

                                {/* 2. CLIENTE */}
                                <td>
                                    <div className="cell-cliente">{c.nombre}</div>
                                    <span className="cell-subtext">{c.telefono}</span>
                                </td>

                                {/* 3. INTENCIÓN IA */}
                                <td>
                                    <span style={{ fontSize: '0.85em', fontWeight: '500', color: '#475569' }}>
                                        {c.crm_intent}
                                    </span>
                                </td>

                                {/* 4. PRÓXIMA ACCIÓN (CON DRAFT) */}
                                <td>
                                    {c.situacion.tipo !== 'NADA' ? (
                                        <div>
                                            <div style={{fontSize: '0.9em', fontWeight: 'bold'}}>
                                                {new Date(c.situacion.fecha).toLocaleDateString()}
                                            </div>
                                            <div style={{fontSize: '0.75em', color: '#64748b'}}>
                                                Hora: {c.situacion.hora_envio || 'Automática'}
                                            </div>
                                            {/* Preview del mensaje */}
                                            {c.situacion.draft && (
                                                <div style={{fontSize: '0.7em', color: '#94a3b8', fontStyle: 'italic', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                    "{c.situacion.draft}"
                                                </div>
                                            )}
                                        </div>
                                    ) : <span className="text-gray-400">-</span>}
                                </td>

                                {/* 5. ÚLTIMO CHAT */}
                                <td>
                                    <div style={{fontSize: '0.85em'}}>
                                        {new Date(c.last_interaction).toLocaleDateString()}
                                    </div>
                                    <div style={{fontSize: '0.75em', color: '#94a3b8'}}>
                                        {new Date(c.last_interaction).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedClient && (
                <ClientDetailsDrawer 
                    cliente={selectedClient} 
                    onClose={() => setSelectedClient(null)} 
                />
            )}
        </div>
    );
};

export default CrmDashboardV3;