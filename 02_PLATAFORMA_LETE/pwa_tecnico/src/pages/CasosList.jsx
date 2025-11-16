import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../apiService';
import { Link } from 'react-router-dom';

const listStyle = {
  backgroundColor: '#F8FAFC',
  minHeight: '100vh',
  padding: '32px',
  paddingBottom: '100px' // Espacio extra abajo para que el botón flotante no tape el último caso
};

const cardStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  padding: '24px',
  marginBottom: '20px',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
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

// --- ESTILO DEL BOTÓN FLOTANTE (FAB) ---
const fabStyle = {
  position: 'fixed',
  bottom: '30px',
  right: '30px',
  backgroundColor: '#0056b3', // Color azul fuerte corporativo
  color: 'white',
  borderRadius: '50px',
  padding: '15px 25px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
  textDecoration: 'none',
  fontSize: '18px',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  zIndex: 1000,
  cursor: 'pointer',
  border: '2px solid white' // Un borde blanco para que resalte más
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
            filteredCasos.map(caso => (
              <div key={caso.id} style={cardStyle}>
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
                  <Link to={`/revision?token=${caso.token}`} style={{ textDecoration: 'none', flex: 1, display: 'flex' }}>
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
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- BOTÓN FLOTANTE DE COTIZADOR --- */}
      <Link to="/cotizador" style={fabStyle}>
        <span style={{fontSize: '24px'}}>➕</span> 
        <span>Cotizar</span>
      </Link>

    </div>
  );
}

export default CasosList;