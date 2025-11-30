import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // <--- 1. IMPORTAR useNavigate
import axios from 'axios'; // <--- 2. IMPORTAR axios
import dayjs from 'dayjs';
import { getAgendaPorDia } from '../apiService';
import CierreCasoModal from './CierreCasoModal';

// Altura aumentada para dar espacio
const HOUR_HEIGHT = 140;

// URL DEL BACKEND NUEVO (Node.js)
const CRM_API = 'https://api.tesivil.com/api';

const timelineContainerStyles = {
  position: 'relative',
  overflowY: 'auto',
  height: 'calc(100vh - 70px)',
};

const hourGridStyles = {
  paddingLeft: '60px',
  paddingRight: '10px',
  height: `${24 * HOUR_HEIGHT}px`,
};

const hourSlotStyles = {
  height: `${HOUR_HEIGHT}px`,
  borderBottom: '1px solid #f0f0f0',
  boxSizing: 'border-box',
  position: 'relative',
  zIndex: 1,
};

const timeLabelStyles = {
  position: 'absolute',
  left: '0px',
  top: '0px',
  fontSize: '12px',
  color: '#999',
  width: '50px',
  textAlign: 'right',
  paddingRight: '10px',
  marginTop: '-6px'
};

const actionsGridStyles = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)', // <--- 3. CAMBIO: 6 Columnas ahora
  gap: '4px',
  marginTop: 'auto',
  paddingTop: '8px',
  borderTop: '1px solid rgba(0,0,0,0.05)'
};

const DiaTimeline = ({ date }) => {
  const navigate = useNavigate(); // Hook de navegación
  const [citas, setCitas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [casoParaCerrar, setCasoParaCerrar] = useState(null);

  const timelineRef = useRef(null);

  const fetchAgenda = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getAgendaPorDia(date);
      setCitas(response.data || []);
    } catch (error) {
      console.error('Error fetching agenda:', error);
      setCitas([]);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  useEffect(() => {
    if (!isLoading && dayjs(date).isSame(dayjs(), 'day')) {
      setTimeout(() => {
        if (timelineRef.current) {
          const currentHour = dayjs().hour();
          const scrollPos = (currentHour * HOUR_HEIGHT) - 50;
          timelineRef.current.scrollTop = scrollPos > 0 ? scrollPos : 0;
        }
      }, 100);
    }
  }, [date, isLoading]);

  const handleCaseClosedSuccess = () => {
    if (casoParaCerrar) {
      setCitas(prevCitas => prevCitas.map(cita => {
        if (cita.caso && cita.caso.id === casoParaCerrar.id) {
          return {
            ...cita,
            caso: {
              ...cita.caso,
              status: 'cerrado'
            }
          };
        }
        return cita;
      }));
    }
    setCasoParaCerrar(null);
    fetchAgenda();
  };

  const handleOpenMaps = (caso) => {
    const direccion = caso.cliente?.direccion_principal || caso.cliente_direccion || caso.direccion;
    if (!direccion) {
      alert("No hay dirección registrada para este cliente.");
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=$?q=${encodeURIComponent(direccion)}`;
    window.open(url, "_blank");
  };

  // --- 4. NUEVA FUNCIÓN: ABRIR CHAT WHATSAPP ---
  const handleOpenChat = async (caso) => {
    // Intentamos sacar el teléfono de donde esté disponible
    const telefono = caso.cliente?.telefono || caso.cliente_telefono || caso.telefono;
    const nombre = caso.cliente?.nombre_completo || caso.cliente_nombre || 'Cliente';

    if (!telefono) {
      alert("Este caso no tiene un teléfono registrado para chatear.");
      return;
    }

    try {
      // Pedimos al CRM Nuevo que nos de el chat ID
      const res = await axios.post(`${CRM_API}/conversations/init`, {
        phone: telefono,
        name: nombre
      });

      // Redirigimos a la pantalla de Soporte con el chat precargado
      navigate('/soporte', { state: { autoSelectChat: res.data } });

    } catch (error) {
      console.error('Error abriendo chat:', error);
      alert("No se pudo iniciar el chat. Verifica tu conexión.");
    }
  };
  // ---------------------------------------------

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div ref={timelineRef} style={timelineContainerStyles}>
      {isLoading ? (
        <p style={{ textAlign: 'center', padding: '20px' }}>Cargando agenda...</p>
      ) : (
        <div style={hourGridStyles}>
          {hours.map(hour => (
            <div key={hour} id={`hora-${hour}`} style={hourSlotStyles}>
              <span style={timeLabelStyles}>{`${String(hour).padStart(2, '0')}:00`}</span>
            </div>
          ))}

          {citas.map(cita => {
            const start = dayjs(cita.start_datetime);
            const end = dayjs(cita.end_datetime);
            const top = (start.hour() + start.minute() / 60) * HOUR_HEIGHT;
            const durationInMinutes = end.diff(start, 'minute');
            const visualDuration = Math.max(durationInMinutes, 45);
            const height = (visualDuration / 60) * HOUR_HEIGHT;

            const style = {
              top: `${top}px`,
              height: `${height}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 10,
              width: 'calc(100% - 70px)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            };

            const tipoCaso = cita.caso?.tipo || 'default';
            const cardClassName = `cita-card card-${tipoCaso}`;

            const isCasoActivo = cita.caso &&
              cita.caso.status !== 'cerrado' &&
              cita.caso.status !== 'completado';

            return (
              <div key={cita.id} className={cardClassName} style={style}>
                {cita.caso ? (
                  <>
                    <div className="cita-content" style={{ overflow: 'hidden' }}>
                      <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.95rem' }}>
                        {cita.caso.cliente?.nombre_completo || cita.caso.cliente_nombre || 'Cliente'}
                      </strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>
                        {dayjs(cita.start_datetime).format('h:mm A')} - {dayjs(cita.end_datetime).format('h:mm A')}
                      </p>
                    </div>

                    <div className="cita-actions" style={actionsGridStyles}>
                      {/* 1. WHATSAPP (NUEVO) - Lo pongo primero por relevancia */}
                      <button
                        className="cita-icon-button"
                        onClick={() => handleOpenChat(cita.caso)}
                        title="Chat WhatsApp"
                        style={{ width: '100%', backgroundColor: '#dcfce7', borderColor: '#22c55e' }}
                      >
                        💬
                      </button>

                      {/* 2. MAPA */}
                      <button
                        className="cita-icon-button"
                        onClick={() => handleOpenMaps(cita.caso)}
                        title="Abrir en Google Maps"
                        style={{ width: '100%' }}
                      >
                        📍
                      </button>

                      {/* 3. DETALLES */}
                      <Link
                        to={`/detalle-caso/${cita.caso.id}`}
                        className="cita-icon-button"
                        title="Ver Detalles"
                        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      >
                        ℹ️
                      </Link>

                      {/* 4. REVISIÓN */}
                      {(cita.caso.tipo !== 'levantamiento' && isCasoActivo) ? (
                        <Link
                          to={`/revision/${cita.caso.id}`}
                          className="cita-icon-button"
                          title="Iniciar Revisión"
                          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        >
                          📝
                        </Link>
                      ) : (<div />)}

                      {/* 5. COTIZAR */}
                      {(isCasoActivo || cita.caso.tipo === 'alto_consumo') ? (
                        <Link
                          to="/cotizador"
                          state={{
                            casoId: cita.caso.id,
                            clienteNombre: cita.caso.cliente?.nombre_completo || cita.caso.cliente_nombre,
                            clienteDireccion: cita.caso.cliente?.direccion_principal || cita.caso.cliente_direccion
                          }}
                          className="cita-icon-button"
                          title="Crear Cotización"
                          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        >
                          ⚡
                        </Link>
                      ) : (<div />)}

                      {/* 6. COBRAR */}
                      {isCasoActivo ? (
                        <button
                          className="cita-icon-button"
                          style={{ backgroundColor: '#e8f5e9', borderColor: '#4caf50', width: '100%' }}
                          onClick={() => setCasoParaCerrar(cita.caso)}
                          title="Cobrar y Cerrar Caso"
                        >
                          💰
                        </button>
                      ) : (<div />)}
                    </div>
                  </>
                ) : (
                  <>
                    <strong style={{ fontSize: '0.9rem' }}>Cita Personal</strong>
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>{dayjs(cita.start_datetime).format('h:mm A')}</p>
                  </>
                )}
              </div>
            );
          })}

          <div style={{ height: '100px' }}></div>
        </div>
      )}

      {casoParaCerrar && (
        <CierreCasoModal
          caso={casoParaCerrar}
          onClose={() => setCasoParaCerrar(null)}
          onCaseClosed={handleCaseClosedSuccess}
        />
      )}
    </div>
  );
};

export default DiaTimeline;