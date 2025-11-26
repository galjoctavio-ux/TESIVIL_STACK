import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { getAgendaPorDia } from '../apiService';
import CierreCasoModal from './CierreCasoModal';

// Altura aumentada para dar espacio
const HOUR_HEIGHT = 140;

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
  gridTemplateColumns: 'repeat(5, 1fr)', // <--- CAMBIO: 5 Columnas para que quepan todos
  gap: '4px', // Gap reducido para que entren en móvil
  marginTop: 'auto',
  paddingTop: '8px',
  borderTop: '1px solid rgba(0,0,0,0.05)'
};

const DiaTimeline = ({ date }) => {
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
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, "_blank");
  };

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
                      {/* 1. MAPA */}
                      <button
                        className="cita-icon-button"
                        onClick={() => handleOpenMaps(cita.caso)}
                        title="Abrir en Google Maps"
                        style={{ width: '100%' }}
                      >
                        📍
                      </button>

                      {/* 2. DETALLES */}
                      <Link
                        to={`/detalle-caso/${cita.caso.id}`}
                        className="cita-icon-button"
                        title="Ver Detalles"
                        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      >
                        ℹ️
                      </Link>

                      {/* 3. REVISIÓN */}
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

                      {/* 4. COTIZAR (EL RAYITO REGRESA) */}
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

                      {/* 5. COBRAR */}
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