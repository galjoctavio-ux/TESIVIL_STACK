import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getExpedienteTecnico } from '../apiService';

// Estilos inline para evitar crear más archivos CSS y mantenerlo simple
const styles = {
    container: { padding: '16px', paddingBottom: '80px', background: '#f9fafb', minHeight: '100vh' },
    header: { display: 'flex', alignItems: 'center', marginBottom: '20px' },
    backBtn: { background: 'none', border: 'none', fontSize: '1.5rem', marginRight: '10px', cursor: 'pointer' },
    title: { fontSize: '1.2rem', margin: 0, fontWeight: 'bold' },
    card: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: '1px solid #eee' },
    label: { fontSize: '0.8rem', color: '#666', marginBottom: '4px', display: 'block' },
    value: { fontSize: '1rem', color: '#333', marginBottom: '12px', fontWeight: '500' },
    mapBtn: { display: 'block', width: '100%', padding: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontWeight: 'bold', marginTop: '10px' },
    warningBox: { background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', marginTop: '10px', border: '1px solid #fecaca' },
    descBox: { background: '#f8f9fa', padding: '10px', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '0.95rem' }
};

const DetalleCaso = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caso, setCaso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const cargarExpediente = async () => {
            try {
                const res = await getExpedienteTecnico(id);
                setCaso(res.data);
            } catch (err) {
                console.error(err);
                setError('No se pudo cargar el expediente. Verifica tu conexión.');
            } finally {
                setLoading(false);
            }
        };
        cargarExpediente();
    }, [id]);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando expediente...</div>;
    if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>;
    if (!caso) return <div style={{ padding: '20px', textAlign: 'center' }}>Caso no encontrado.</div>;

    return (
        <div style={styles.container}>
            {/* HEADER */}
            <div style={styles.header}>
                <button onClick={() => navigate(-1)} style={styles.backBtn}>←</button>
                <div>
                    <h1 style={styles.title}>Orden #{caso.id}</h1>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>
                        {dayjs(caso.fecha).format('DD MMM YYYY • h:mm A')}
                    </span>
                </div>
            </div>

            {/* 1. UBICACIÓN Y CLIENTE (Sin teléfono) */}
            <div style={styles.card}>
                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>📍 Ubicación</h3>

                <span style={styles.label}>Cliente</span>
                <div style={styles.value}>{caso.cliente.nombre}</div>

                <span style={styles.label}>Dirección</span>
                <div style={styles.value}>{caso.cliente.direccion}</div>

                {/* ALERTA DE DEUDA (Sin mostrar monto) */}
                {caso.cliente.tiene_deuda && (
                    <div style={styles.warningBox}>
                        ⚠️ <strong>Atención:</strong> Este cliente tiene saldos pendientes anteriores.
                    </div>
                )}

                {/* BOTÓN MAPAS */}
                {caso.cliente.maps_link ? (
                    <a href={caso.cliente.maps_link} target="_blank" rel="noreferrer" style={styles.mapBtn}>
                        🗺️ Abrir en Google Maps
                    </a>
                ) : (
                    <button onClick={() => alert('No hay enlace de mapa disponible')} style={{ ...styles.mapBtn, opacity: 0.5 }}>
                        Sin enlace de Mapa
                    </button>
                )}
            </div>

            {/* 2. REPORTE DEL PROBLEMA */}
            <div style={styles.card}>
                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>🔧 Reporte Inicial</h3>

                <span style={styles.label}>Servicio Solicitado</span>
                <div style={styles.value}>{caso.tipo || 'General'}</div>

                <span style={styles.label}>Descripción</span>
                <div style={styles.descBox}>
                    {caso.problema || 'Sin detalles proporcionados.'}
                </div>
            </div>

            {/* 3. DATOS TÉCNICOS PREVIOS (Si existen) */}
            {caso.ultima_revision && (
                <div style={styles.card}>
                    <h3 style={{ marginTop: 0, fontSize: '1rem' }}>⚡ Última Revisión Técnica</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <span style={styles.label}>Voltaje</span>
                            <div>{caso.ultima_revision.voltaje_medido || '--'} V</div>
                        </div>
                        <div>
                            <span style={styles.label}>Fugas</span>
                            <div>{caso.ultima_revision.resultado_deteccion_fugas || 'N/A'}</div>
                        </div>
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#888' }}>
                        Fecha: {dayjs(caso.ultima_revision.created_at).format('DD/MM/YYYY')}
                    </div>
                </div>
            )}

        </div>
    );
};

export default DetalleCaso;