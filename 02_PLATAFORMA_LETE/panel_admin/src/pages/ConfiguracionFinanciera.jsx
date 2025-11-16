import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerConfiguracion, actualizarConfiguracion } from '../apiService';

const ConfiguracionFinanciera = () => {
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const res = await obtenerConfiguracion();
      if (res.status === 'success') {
        setConfig(res.data);
      }
    } catch (error) {
      setMensaje(`Error cargando datos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (clave, nuevoValor) => {
    const nuevaConfig = config.map(item =>
      item.clave === clave ? { ...item, valor: nuevoValor } : item
    );
    setConfig(nuevaConfig);
  };

  const handleGuardar = async () => {
    if (!window.confirm("¿Confirmar cambios en las variables financieras? Esto afectará a todas las cotizaciones NUEVAS.")) return;

    setSaving(true);
    setMensaje('');

    // Convertir array a objeto clave:valor para la API
    const objetoEnvio = {};
    config.forEach(item => {
      objetoEnvio[item.clave] = item.valor;
    });

    try {
      const res = await actualizarConfiguracion(objetoEnvio);
      if (res.status === 'success') {
        setMensaje('✅ Parámetros actualizados correctamente.');
      } else {
        setMensaje(`Error: ${res.error}`);
      }
    } catch (error) {
      setMensaje(`Error de conexión: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/dashboard" style={{ textDecoration: 'none', color: '#007bff', marginBottom: '20px', display: 'inline-block' }}>
        &larr; Volver al Dashboard
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>⚙️ Sala de Máquinas</h2>
          <small style={{ color: '#666' }}>Variables Financieras Globales</small>
        </div>
      </div>

      {mensaje && <div style={{ padding: '10px', marginBottom: '15px', background: mensaje.includes('Error') ? '#f8d7da' : '#d4edda', borderRadius: '5px' }}>{mensaje}</div>}

      {loading ? <p>Cargando parámetros...</p> : (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Parámetro</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Valor</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {config.map((item) => (
                <tr key={item.clave} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#0056b3', fontSize: '0.9em' }}>
                    {item.clave}
                  </td>
                  <td style={{ padding: '12px', width: '150px' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={item.valor}
                      onChange={(e) => handleChange(item.clave, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontWeight: 'bold',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', color: '#555', fontSize: '0.9em' }}>
                    {item.descripcion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '20px', textAlign: 'right' }}>
            <button
              onClick={handleGuardar}
              disabled={saving}
              style={{
                padding: '12px 25px',
                background: saving ? '#6c757d' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: saving ? 'wait' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {saving ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfiguracionFinanciera;
