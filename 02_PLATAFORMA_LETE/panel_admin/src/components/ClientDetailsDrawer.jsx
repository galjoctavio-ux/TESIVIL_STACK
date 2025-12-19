import React from 'react';
import './ClientDetailsDrawer.css';

const ClientDetailsDrawer = ({ cliente, onClose }) => {
    if (!cliente) return null;

    // Helper para formatear fecha bonita
    const formatDate = (dateString) => {
        if (!dateString) return 'Sin fecha';
        return new Date(dateString).toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <>
            <div className="drawer-overlay" onClick={onClose}></div>
            <div className="drawer-panel">
                
                {/* HEADER */}
                <div className="drawer-header">
                    <div>
                        <h2>{cliente.nombre}</h2>
                        <span style={{ fontSize: '0.9em', color: '#64748b' }}>
                            {cliente.telefono}
                        </span>
                    </div>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                {/* CONTENT */}
                <div className="drawer-content">

                    {/* 1. ACCIONES RÁPIDAS */}
                    <div className="action-grid">
                        <a 
                            href={`https://wa.me/${cliente.telefono?.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-action btn-whatsapp"
                        >
                            💬 Abrir WhatsApp
                        </a>
                        <button className="btn-action">
                            📂 Ver Historial Casos
                        </button>
                    </div>

                    {/* 2. CEREBRO IA (Lo más importante) */}
                    <div className="detail-section">
                        <div className="section-title">🧠 Diagnóstico IA (Última Interacción)</div>
                        {cliente.ai_summary ? (
                            <div className="ai-summary-box">
                                {cliente.ai_summary}
                            </div>
                        ) : (
                            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin análisis reciente.</p>
                        )}
                        <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#64748b' }}>
                            Último mensaje: {formatDate(cliente.last_interaction)}
                        </div>
                    </div>

                    {/* 3. PRÓXIMA ACCIÓN AUTOMÁTICA (CON PREVIEW) */}
                    <div className="detail-section">
                        <div className="section-title">🤖 Autómata (Cron)</div>
                        {cliente.situacion?.tipo !== 'NADA' ? (
                            <div>
                                <div style={{ 
                                    padding: '8px', 
                                    borderRadius: '4px', 
                                    background: cliente.situacion?.color === 'red' ? '#fef2f2' : '#f0fdf4',
                                    color: cliente.situacion?.color === 'red' ? '#b91c1c' : '#15803d',
                                    fontWeight: 'bold',
                                    marginBottom: '5px'
                                }}>
                                    {cliente.situacion?.label}
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', marginBottom: '10px' }}>
                                    <span>📅 Fecha: {formatDate(cliente.situacion?.fecha)}</span>
                                    <span>⏰ Hora: {cliente.situacion?.hora_envio}</span>
                                </div>

                                {/* CAJA DEL MENSAJE (PREVIEW) */}
                                {cliente.situacion?.draft && (
                                    <div style={{ 
                                        background: '#f8fafc', 
                                        border: '1px dashed #cbd5e1', 
                                        padding: '10px', 
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        color: '#334155',
                                        fontStyle: 'italic'
                                    }}>
                                        📝 <strong>Se enviará esto:</strong><br/>
                                        "{cliente.situacion.draft}"
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p>El bot está en reposo. Esperando interacción del cliente o acción manual.</p>
                        )}
                    </div>

                    {/* 4. INTEGRIDAD Y TÉCNICO */}
                    <div className="detail-section">
                        <div className="section-title">📋 Datos Operativos</div>
                        <table style={{ width: '100%', fontSize: '0.9rem' }}>
                            <tbody>
                                <tr>
                                    <td style={{ color: '#64748b', padding: '5px 0' }}>Integridad:</td>
                                    <td><strong>{cliente.status_integridad}</strong></td>
                                </tr>
                                <tr>
                                    <td style={{ color: '#64748b', padding: '5px 0' }}>Técnico Asignado:</td>
                                    <td>{cliente.tecnico}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: '#64748b', padding: '5px 0' }}>Saldo Pendiente:</td>
                                    <td style={{ color: cliente.saldo_pendiente > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                                        ${cliente.saldo_pendiente}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </>
    );
};

export default ClientDetailsDrawer;