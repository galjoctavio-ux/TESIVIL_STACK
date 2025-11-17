import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../apiService';
import { Link } from 'react-router-dom';
import '../App.css'; // Importa el CSS

const listStyle = {
  backgroundColor: '#F8FAFC',
  minHeight: '100vh',
  padding: '32px',
  paddingBottom: '100px' // Espacio extra abajo para que el botón flotante no tape el último caso
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #E2E8F0',
  flexWrap: 'wrap', // Para que se ajuste en celulares pequeños
  gap: '10px'
};

const actionButtonStyles = {
  border: 'none',
  borderRadius: '6px',
  padding: '10px 18px',
  fontSize: '15px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease, transform 0.2s ease',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center',
};


function CasosList() {
  const { user, logout } = useAuth();
  const [casos, setCasos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    const fetchCasos = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/casos');
        setCasos(response.data);
      } catch (err) {
        setError('Error al cargar casos asignados.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCasos();
  }, []);

  const filteredCasos = casos.filter(caso => showCompleted || caso.status !== 'completado');

  return (
    <div style={listStyle}>
      <header style={headerStyles}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1E293B', margin: 0 }}>Mis Casos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <label style={{ color: '#475569', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={() => setShowCompleted(!showCompleted)}
              style={{ marginRight: '8px' }}
            />
            Ver Historial
          </label>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
             <span style={{ color: '#475569', fontSize:'0.9em' }}>
               Hola, <strong>{user?.nombre}</strong>
             </span>
             <button onClick={logout} style={{ ...actionButtonStyles, backgroundColor: '#F1F5F9', color: '#1E293B', padding: '8px 12px' }}>
               Salir
             </button>
          </div>
        </div>
      </header>

      {isLoading && <p>Cargando casos...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!isLoading && !error && (
        <div>
          {filteredCasos.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                <p>No tienes casos asignados pendientes.</p>
                <p>Puedes crear una cotización nueva con el botón azul.</p>
            </div>
          ) : (
            filteredCasos.map(caso => {
              const cardClassName = `card ${
                caso.tipo === 'alto_consumo' ? 'card-amarillo' :
                caso.tipo === 'proyecto' ? 'card-azul' :
                caso.tipo === 'levantamiento' ? 'card-morado' : ''
              }`;
              return (
              <div key={caso.id} className={cardClassName}>
                <h3 style={{ fontSize: '20px', color: '#10213F', marginBottom: '12px' }}>
                  Cliente: {caso.cliente_nombre}
                </h3>
                <p style={{ color: '#475569', marginBottom: '8px' }}>
                  <strong>Dirección:</strong> {caso.cliente_direccion}
                </p>
                <p style={{ color: '#475569', marginBottom: '20px' }}>
                  <strong>Estado:</strong> <span style={{ fontWeight: '600', color: caso.status === 'completado' ? '#16A34A' : '#F59E0B' }}>
                    {caso.status}
                  </span>
                </p>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(caso.cliente_direccion)}`, "_blank")}
                    style={{...actionButtonStyles, backgroundColor: '#3B82F6', color: 'white', flex: 1}}
                  >
                    📍 Mapa
                  </button>
                  {caso.tipo !== 'levantamiento' && (
                    <Link to={`/revision/${caso.id}`} style={{ textDecoration: 'none', flex: 1, display: 'flex' }}>
                      <button
                        style={{
                          ...actionButtonStyles,
                          backgroundColor: caso.status === 'completado' ? '#D1D5DB' : '#10B981',
                          color: 'white',
                          width: '100%'
                        }}
                        disabled={caso.status === 'completado'}
                      >
                        {caso.status === 'completado' ? 'Completado' : '📝 Revisar'}
                      </button>
                    </Link>
                  )}
                </div>

                {/* ======================================================= */}
                {/* ===========   AÑADIR ESTE NUEVO BOTÓN   =========== */}
                {/* ======================================================= */}
                {/* Solo mostrar si el caso no está completado */}
                {caso.status !== 'completado' && (
                  <Link
                    to="/cotizador"
                    state={{
                      casoId: caso.id,
                      clienteNombre: caso.cliente_nombre,
                      clienteDireccion: caso.cliente_direccion
                      // Aquí también podrías pasar el email si lo tuvieras
                    }}
                    style={{ textDecoration: 'none', display: 'block', marginTop: '12px' }}
                  >
                    <button
                      style={{
                        ...actionButtonStyles,
                        backgroundColor: '#007bff', // Azul para cotizar
                        color: 'white',
                        width: '100%'
                      }}
                    >
                      ⚡ Cotizar
                    </button>
                  </Link>
                )}
                {/* ======================================================= */}
                {/* ==================  FIN DE LA ADICIÓN  ================== */}
                {/* ======================================================= */}

              </div>
            )})
          )}
        </div>
      )}

    </div>
  );
}

export default CasosList;