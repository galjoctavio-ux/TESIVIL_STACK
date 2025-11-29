import React, { useEffect, useState } from 'react';
import api from '../apiService';
import './ConfiguracionPagos.css';

const ConfiguracionPagos = () => {
    // Estado para guardar la lista de configuraciones que vienen de Node/Supabase
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estado para controlar qué fila se está editando
    const [editingKey, setEditingKey] = useState(null);
    const [tempValue, setTempValue] = useState('');

    // 1. Cargar datos al iniciar
    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            // Llamamos a TU backend Node (no al de PHP)
            const { data } = await api.get('/config');
            // Ordenamos alfabéticamente
            const sorted = data.sort((a, b) => a.clave.localeCompare(b.clave));
            setConfigs(sorted);
        } catch (error) {
            console.error("Error cargando configs:", error);
            alert("Error conectando con el servidor de pagos.");
        } finally {
            setLoading(false);
        }
    };

    // 2. Modo Edición
    const handleEdit = (item) => {
        setEditingKey(item.clave);
        setTempValue(item.valor);
    };

    const handleCancel = () => {
        setEditingKey(null);
        setTempValue('');
    };

    // 3. Guardar Cambios (Uno por uno para mayor seguridad)
    const handleSave = async (clave) => {
        try {
            await api.put('/config', {
                clave: clave,
                valor: tempValue
            });

            // Actualizamos la tabla visualmente sin recargar
            setConfigs(prev => prev.map(item =>
                item.clave === clave ? { ...item, valor: tempValue } : item
            ));

            setEditingKey(null);
        } catch (error) {
            console.error(error);
            alert('Error al actualizar el precio.');
        }
    };

    if (loading) return <div className="pagos-container">Cargando tablero de costos...</div>;

    return (
        <div className="pagos-container">
            <div className="pagos-header">
                <div>
                    <h2>🛠️ Costos y Tarifas Técnicas</h2>
                    <small>Define cuánto gana el técnico y cuánto cuestan los servicios en la Billetera.</small>
                </div>
            </div>

            <table className="pagos-table">
                <thead>
                    <tr>
                        <th style={{ width: '40%' }}>Concepto</th>
                        <th style={{ width: '20%' }}>Valor ($)</th>
                        <th>Descripción</th>
                        <th style={{ width: '10%' }}>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {configs.map((item) => (
                        <tr key={item.clave}>
                            <td>
                                <span className="badge-clave">{item.clave}</span>
                            </td>
                            <td>
                                {editingKey === item.clave ? (
                                    <input
                                        type="number"
                                        className="input-dinero"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        autoFocus
                                    />
                                ) : (
                                    <span style={{ fontWeight: 'bold', color: '#27ae60' }}>
                                        ${Number(item.valor).toFixed(2)}
                                    </span>
                                )}
                            </td>
                            <td style={{ fontSize: '0.9rem' }}>{item.descripcion}</td>
                            <td>
                                {editingKey === item.clave ? (
                                    <>
                                        <button className="btn-action" onClick={() => handleSave(item.clave)} title="Guardar">💾</button>
                                        <button className="btn-action" onClick={handleCancel} title="Cancelar">❌</button>
                                    </>
                                ) : (
                                    <button className="btn-action" onClick={() => handleEdit(item)} title="Editar">✏️</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ConfiguracionPagos;