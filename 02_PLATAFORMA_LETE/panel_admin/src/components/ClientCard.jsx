import React from 'react';
// Importamos íconos para una interfaz visual intuitiva
import { FaCalendarAlt, FaUserTie, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaCommentDots, FaMoneyBillWave } from 'react-icons/fa';
import { BsChatDotsFill } from 'react-icons/bs';

/**
 * Formateador de Fechas Amigable
 * Ejemplo: "15 dic, 14:30"
 */
const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'Fecha Inválida';
    }
};

/**
 * Formateador de Moneda
 */
const formatCurrency = (amount) => {
    const val = parseFloat(amount || 0);
    return `$${val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

/**
 * Selector de Ícono según Integridad
 */
const getIntegrityIcon = (status) => {
    switch (status) {
        case 'OK': return <FaCheckCircle style={{ color: '#10b981' }} />; // Verde
        case 'MANUAL': return <FaExclamationTriangle style={{ color: '#f59e0b' }} />; // Naranja
        case 'ERROR_GHOST': return <FaTimesCircle style={{ color: '#ef4444' }} />; // Rojo
        default: return <FaCheckCircle style={{ color: '#64748b' }} />; // Gris
    }
};

const ClientCard = ({ cliente, onAction }) => {
    // Desestructuración para código más limpio
    const {
        nombre_completo,
        telefono,
        crm_intent,
        ai_summary,
        cita_real,
        tecnico_asignado,
        status_integridad,
        mensaje_integridad,
        accion_sugerida,
        finanzas,
        last_interaction,
        id
    } = cliente;

    // Clase dinámica para el borde de color (status-OK, status-MANUAL, etc.)
    const cardClass = `cliente-card status-${status_integridad}`;

    return (
        <div className={cardClass}>
            {/* --- ENCABEZADO: IDENTIDAD --- */}
            <div className="card-header">
                <div>
                    <div className="card-title" title={nombre_completo}>
                        {nombre_completo || `ID: ${id.substring(0, 8)}...`}
                    </div>
                    <div className="card-subtitle">
                        {telefono}
                    </div>
                </div>
                {/* Badge de Intención (Intent) */}
                <div className={`badge ${crm_intent === 'NONE' || !crm_intent ? 'badge-intent-none' : 'badge-intent'}`}>
                    {crm_intent || 'PENDIENTE'}
                </div>
            </div>

            {/* --- DETALLES: EL NÚCLEO DE LA AUDITORÍA --- */}
            <div className="card-details">

                {/* 1. Estado de Integridad (Semáforo) */}
                <div className="detail-row">
                    {getIntegrityIcon(status_integridad)}
                    <span className={`status-label ${status_integridad}`}>
                        {mensaje_integridad}
                    </span>
                </div>

                {/* 2. Técnico Asignado */}
                <div className="detail-row">
                    <FaUserTie title="Técnico Responsable" />
                    <span>
                        Técnico:
                        <span style={{ fontWeight: '600', marginLeft: '5px', color: tecnico_asignado ? '#1e293b' : '#ef4444' }}>
                            {tecnico_asignado || 'SIN ASIGNAR'}
                        </span>
                    </span>
                </div>

                {/* 3. Agenda Real */}
                <div className="detail-row">
                    <FaCalendarAlt title="Fecha en Agenda MariaDB" />
                    <span>
                        Cita:
                        <span style={{ fontWeight: '600', marginLeft: '5px', color: cita_real ? '#059669' : '#94a3b8' }}>
                            {cita_real ? formatDate(cita_real.fecha) : 'NO AGENDADO'}
                        </span>
                    </span>
                </div>

                {/* 4. Finanzas (Deuda vs Cobrado) */}
                <div className="detail-row">
                    <FaMoneyBillWave title="Estado Financiero" />
                    <span>
                        Pendiente:
                        <span style={{ fontWeight: '600', marginLeft: '5px', color: finanzas.saldo_pendiente > 0 ? '#ef4444' : '#64748b' }}>
                            {formatCurrency(finanzas.saldo_pendiente)}
                        </span>
                        <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                        Cobrado: {formatCurrency(finanzas.total_pagado)}
                    </span>
                </div>

                {/* 5. Última Interacción */}
                <div className="detail-row" style={{ marginTop: '5px', color: '#94a3b8', fontSize: '0.85em' }}>
                    <FaCommentDots title="Última actividad IA" />
                    <span>Actividad: {formatDate(last_interaction)}</span>
                </div>
            </div>

            {/* --- FOOTER: ACCIÓN Y RESUMEN --- */}
            <div className="card-footer">
                {/* Snippet del resumen de la IA */}
                <div className="ai-summary-snippet" title={ai_summary}>
                    {ai_summary
                        ? (ai_summary.length > 65 ? ai_summary.substring(0, 65) + '...' : ai_summary)
                        : 'Sin resumen reciente.'}
                </div>

                {/* Botón de Acción Principal */}
                <button
                    onClick={() => onAction(cliente, accion_sugerida)}
                    className="btn-action"
                    style={{ backgroundColor: accion_sugerida === 'REVISAR_MANUAL' ? '#ef4444' : '#3b82f6' }}
                    title={accion_sugerida === 'REVISAR_MANUAL' ? 'Ver discrepancia' : 'Abrir chat'}
                >
                    {accion_sugerida === 'REVISAR_MANUAL' ? 'Revisar' : 'Chat'}
                    <BsChatDotsFill style={{ marginLeft: '6px' }} />
                </button>
            </div>
        </div>
    );
};

export default ClientCard;