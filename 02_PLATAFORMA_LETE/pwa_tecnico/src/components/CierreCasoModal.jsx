import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../apiService';
import './CierreCasoModal.css';

function CierreCasoModal({ caso, onClose, onCaseClosed }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Estado del Formulario
    const [formData, setFormData] = useState({
        metodoPago: 'EFECTIVO',
        montoCobrado: '',
        calificacionCliente: 5,
        tipoCliente: 'AMABLE',
        requiereCotizacion: false,
        notasCierre: ''
    });

    // Lógica visual para la alerta financiera
    // Nota: Aquí podrías traer el costo base de la API, pero para V1 usaremos el estándar visual
    const monto = parseFloat(formData.montoCobrado) || 0;
    const esEfectivo = formData.metodoPago === 'EFECTIVO';

    // Cálculo estimado (Visual)
    const deudaEstimada = esEfectivo ? monto : 0;
    // La comisión la sabe el backend, pero aquí podemos dar una pista
    const mensajeFinanciero = esEfectivo
        ? `⚠️ Al cobrar $${monto} en efectivo, se generará una deuda por ese monto. Tu comisión se sumará aparte.`
        : `✅ Al ser transferencia, NO se genera deuda. Recibirás tu comisión en saldo a favor.`;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleClienteType = (tipo) => {
        setFormData(prev => ({ ...prev, tipoCliente: tipo }));
    };

    const handleSubmit = async () => {
        if (formData.montoCobrado === '') {
            setError('Por favor indica el monto cobrado (o 0).');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.patch(`/casos/${caso.id}/cerrar`, {
                metodoPago: formData.metodoPago,
                montoCobrado: parseFloat(formData.montoCobrado),
                calificacionCliente: formData.calificacionCliente,
                requiereCotizacion: formData.requiereCotizacion,
                notasCierre: formData.notasCierre,
                tipoClienteCRM: formData.tipoCliente
            });

            onCaseClosed(); // Refrescar lista
            onClose();      // Cerrar modal
        } catch (err) {
            console.error(err);
            setError('Error al cerrar el caso. Intenta de nuevo.');
            setLoading(false);
        }
    };

    // Renderizamos en el Body usando Portal
    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content wizard-container">

                {/* HEADER */}
                <div className="wizard-header">
                    <h3>Cerrar Caso #{caso?.id}</h3>
                    <span className="step-indicator">Paso {step} de 3</span>
                </div>

                {error && <div className="error-alert" style={{ margin: '1rem', padding: '10px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px' }}>{error}</div>}

                {/* PASO 1: FINANZAS */}
                {step === 1 && (
                    <div className="wizard-step">
                        <h4>💰 ¿Cómo pagó el cliente?</h4>

                        <div className="payment-toggle">
                            <button
                                className={`payment-btn ${formData.metodoPago === 'EFECTIVO' ? 'active' : ''}`}
                                onClick={() => setFormData({ ...formData, metodoPago: 'EFECTIVO' })}
                            >
                                <span>💵</span> Efectivo
                            </button>
                            <button
                                className={`payment-btn ${formData.metodoPago === 'TRANSFERENCIA' ? 'active' : ''}`}
                                onClick={() => setFormData({ ...formData, metodoPago: 'TRANSFERENCIA' })}
                            >
                                <span>📱</span> Transferencia
                            </button>
                        </div>

                        <label style={{ display: 'block', marginBottom: '5px', color: '#64748b' }}>Monto Total Cobrado ($)</label>
                        <input
                            type="number"
                            name="montoCobrado"
                            value={formData.montoCobrado}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="big-input"
                            autoFocus
                        />

                        {/* ALERTA INTELIGENTE */}
                        <div className={`finance-alert ${esEfectivo ? 'warning' : 'success'}`}>
                            <span>{esEfectivo ? '📉' : '📈'}</span>
                            <p style={{ margin: 0 }}>{mensajeFinanciero}</p>
                        </div>

                        {formData.metodoPago === 'TRANSFERENCIA' && (
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '10px', fontStyle: 'italic' }}>
                                * Recuerda pedir al cliente el comprobante y enviarlo por WhatsApp al grupo de administración.
                            </p>
                        )}
                    </div>
                )}

                {/* PASO 2: CRM */}
                {step === 2 && (
                    <div className="wizard-step">
                        <h4>🚦 Calificación del Cliente</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>Ayuda a otros técnicos a saber cómo es este cliente.</p>

                        <div className="semaforo-grid">
                            <button
                                className={`semaforo-btn green ${formData.tipoCliente === 'AMABLE' ? 'selected' : ''}`}
                                onClick={() => handleClienteType('AMABLE')}
                            >
                                🟢<br />Amable
                            </button>
                            <button
                                className={`semaforo-btn orange ${formData.tipoCliente === 'EXIGENTE' ? 'selected' : ''}`}
                                onClick={() => handleClienteType('EXIGENTE')}
                            >
                                🟡<br />Exigente
                            </button>
                            <button
                                className={`semaforo-btn red ${formData.tipoCliente === 'TOXICO' ? 'selected' : ''}`}
                                onClick={() => handleClienteType('TOXICO')}
                            >
                                🔴<br />Conflictivo
                            </button>
                        </div>
                    </div>
                )}

                {/* PASO 3: CIERRE */}
                {step === 3 && (
                    <div className="wizard-step">
                        <h4>📝 Notas Finales</h4>

                        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
                            <input
                                type="checkbox"
                                name="requiereCotizacion"
                                checked={formData.requiereCotizacion}
                                onChange={handleChange}
                                style={{ width: '20px', height: '20px' }}
                            />
                            <label>¿Requiere Cotización Formal?</label>
                        </div>

                        <label style={{ display: 'block', marginBottom: '5px' }}>Observaciones Técnicas</label>
                        <textarea
                            name="notasCierre"
                            value={formData.notasCierre}
                            onChange={handleChange}
                            placeholder="Detalles del servicio, recomendaciones dadas, etc."
                            rows={4}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>
                )}

                {/* ACCIONES DEL WIZARD */}
                <div className="wizard-actions">
                    {step > 1 ? (
                        <button className="btn-secondary" onClick={() => setStep(step - 1)}>⬅ Atrás</button>
                    ) : (
                        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                    )}

                    {step < 3 ? (
                        <button className="btn-primary" onClick={() => setStep(step + 1)}>Siguiente ➡</button>
                    ) : (
                        <button className="btn-success" onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Cerrando...' : '✅ Finalizar Caso'}
                        </button>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
}

export default CierreCasoModal;