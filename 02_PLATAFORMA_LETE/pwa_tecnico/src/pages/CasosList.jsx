import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { getCotizacionesCountsByTecnico, cerrarCasoManualmente } from '../apiService';
import { Link } from 'react-router-dom';
import '../App.css';

// ... (estilos sin cambios)
const listStyle = {
  backgroundColor: '#F8FAFC',
  minHeight: '100vh',
  padding: '32px',
  paddingBottom: '100px'
};

const headerStyles = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #E2E8F0',
  flexWrap: 'wrap',
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
    const fetchData = async () => {
      if (!user?.id) return; // No hacer nada si el usuario no está cargado

      setIsLoading(true);
      setError(null);

      try {
        // 1. Ejecutar ambas llamadas en paralelo
        const [casosResponse, countsResponse] = await Promise.all([
          api.get('/casos'),
          getCotizacionesCountsByTecnico(user.id)
        ]);

        const casosData = casosResponse.data;
        const countsData = countsResponse.data || [];

        // 2. Crear un mapa para búsqueda rápida de conteos
        const countsMap = new Map(countsData.map(item => [item.caso_id, item.cot_count]));

        // 3. Fusionar los datos
        const casosConConteos = casosData.map(caso => ({
          ...caso,
          cot_count: countsMap.get(caso.id) || 0 // Añadir cot_count, default a 0
        }));

        setCasos(casosConConteos);

      } catch (err) {
        console.error("Error al cargar datos combinados:", err);
        setError('Error al cargar la información de los casos.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]); // Depender de 'user' para re-ejecutar si cambia

  const handleCerrarCaso = async (casoId) => {
    if (!window.confirm('¿Estás seguro de que deseas cerrar este caso? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await cerrarCasoManualmente(casoId);
      // Actualizar el estado local para reflejar el cambio instantáneamente
      setCasos(prevCasos =>
        prevCasos.map(caso =>
          caso.id === casoId ? { ...caso, status: 'completado' } : caso
        )
      );
    } catch (err) {
      console.error('Error al cerrar el caso:', err);
      alert('Hubo un error al intentar cerrar el caso. Por favor, inténtalo de nuevo.');
    }
  };

  const filteredCasos = casos.filter(caso => showCompleted || caso.status !== 'completado');

  return (
    <div style={listStyle}>
      <header style={headerStyles}>
        {/* ... (header sin cambios) */}
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
              // Corrección del color de la tarjeta
              const cardClassName = `card ${
                caso.tipo === 'alto_consumo' ? 'card-amarillo' :
                caso.tipo === 'proyecto' ? 'card-azul' :
                caso.tipo === 'levantamiento' ? 'card-morado' : '' // <-- CORRECCIÓN AQUÍ
              }`;

              const isCerrable = caso.cot_count > 0;

              return (
              <div key={caso.id} className={cardClassName}>
                <h3 style={{ fontSize: '20px', color: '#10213F', marginBottom: '12px' }}>
                  Cliente: {caso.cliente_nombre}
                </h3>
                <p style={{ color: '#475569', marginBottom: '8px' }}>
                  <strong>Dirección:</strong> {caso.cliente_direccion}
                </p>
                <p style={{ color: '#475569', marginBottom: '8px' }}>
                  <strong>Cotizaciones:</strong> {caso.cot_count}
                </p>
                <p style={{ color: '#475569', marginBottom: '20px' }}>
                  <strong>Estado:</strong> <span style={{ fontWeight: '600', color: caso.status === 'completado' ? '#16A34A' : '#F59E0B' }}>
                    {caso.status}
                  </span>
                </p>

                {/* --- SECCIÓN DE BOTONES MODIFICADA --- */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(caso.cliente_direccion)}`, "_blank")}
                    style={{...actionButtonStyles, backgroundColor: '#3B82F6', color: 'white', flex: 1}}
                  >
                    📍 Mapa
                  </button>

                  {caso.status !== 'completado' ? (
                    <button
                      onClick={() => handleCerrarCaso(caso.id)}
                      style={{
                        ...actionButtonStyles,
                        backgroundColor: isCerrable ? '#EF4444' : '#D1D5DB', // Rojo si es cerrable, gris si no
                        color: 'white',
                        flex: 1,
                      }}
                      disabled={!isCerrable}
                      title={!isCerrable ? "Debe crear al menos una cotización para poder cerrar el caso." : "Cerrar el caso permanentemente."}
                    >
                      {isCerrable ? 'Cerrar Caso' : 'Cerrar Caso'}
                    </button>
                  ) : (
                     <button
                      style={{...actionButtonStyles, backgroundColor: '#D1D5DB', color: '#6B7280', flex: 1}}
                      disabled
                    >
                      Completado
                    </button>
                  )}
                </div>

                {caso.status !== 'completado' && (
                  <Link
                    to="/cotizador"
                    state={{
                      casoId: caso.id,
                      clienteNombre: caso.cliente_nombre,
                      clienteDireccion: caso.cliente_direccion,
                      clienteTelefono: caso.cliente_telefono
                    }}
                    style={{ textDecoration: 'none', display: 'block', marginTop: '12px' }}
                  >
                    <button
                      style={{
                        ...actionButtonStyles,
                        backgroundColor: '#007bff',
                        color: 'white',
                        width: '100%'
                      }}
                    >
                      ⚡ Cotizar
                    </button>
                  </Link>
                )}
              </div>
            )})
          )}
        </div>
      )}
    </div>
  );
}

export default CasosList;