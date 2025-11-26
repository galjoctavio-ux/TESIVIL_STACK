import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { getAgendaPorDia } from '../apiService';
import CierreCasoModal from './CierreCasoModal';

const HOUR_HEIGHT = 80;

const timelineContainerStyles = {
  position: 'relative',
  overflowY: 'auto',
  height: 'calc(100vh - 70px)',
};

const hourGridStyles = {
  paddingLeft: '60px',
  paddingRight: '10px', // Agregamos un poco de aire a la derecha
};

const hourSlotStyles = {
  height: `${HOUR_HEIGHT}px`,
  borderBottom: '1px solid #e0e0e0',
  boxSizing: 'border-box',
  position: 'relative',
  zIndex: 1,
};

const timeLabelStyles = {
  position: 'absolute',
  left: '0px',
  transform: 'translateY(-50%)',
  fontSize: '12px',
  color: '#666',
  width: '50px',
  textAlign: 'right',
  paddingRight: '10px',
};

// --- CORRECCIÓN VISUAL: ESTILOS DE LA GRILLA DE ACCIONES ---
const actionsGridStyles = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)', // 4 Columnas exactas
  gap: '8px',            // Espacio entre botones
  marginTop: 'auto',     // Empuja los botones al fondo de la tarjeta
  paddingTop: '5px'
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
          const hourEl = timelineRef.current.querySelector(`#hora-${currentHour}`);
          if (hourEl) {
            hourEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
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
    // --- CORRECCIÓN MAPAS ---
    // 1. Buscamos la dirección en el objeto anidado (cliente) O en la raíz (por si acaso)
    const direccion = caso.cliente?.direccion_principal || caso.cliente_direccion || caso.direccion;

    if (!direccion) {
      alert("No hay dirección registrada para este cliente.");
      return;
    }

    // 2. Usamos la URL universal de Google Maps API
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
            <div key={hour} id={`hora-${hour}`} style={{ ...hourSlotStyles, position: 'relative' }}>
              <span style={timeLabelStyles}>{`${String(hour).padStart(2, '0')}:00`}</span>
            </div>
          ))}

          {citas.map(cita => {
            const start = dayjs(cita.start_datetime);
            const end = dayjs(cita.end_datetime);
            const top = (start.hour() + start.minute() / 60) * HOUR_HEIGHT;
            const durationInMinutes = end.diff(start, 'minute');
            const height = (durationInMinutes / 60) * HOUR_HEIGHT;

            // Ajustamos el estilo para que use Flexbox columna y acomode los botones al final
            const style = {
              top: `${top}px`,
              height: `${height}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between' // Esparce contenido: texto arriba, botones abajo
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
                    <div className="cita-content">
                      {/* Intentamos mostrar nombre del cliente del objeto anidado o plano */}
                      <strong>{cita.caso.cliente?.nombre_completo || cita.caso.cliente_nombre || 'Cliente'}</strong>
                      <p style={{ margin: 0, fontSize: '0.85em' }}>
                        {dayjs(cita.start_datetime).format('h:mm A')} - {dayjs(cita.end_datetime).format('h:mm A')}
                      </p>
                    </div>

                    {/* --- APLICAMOS LA GRILLA DE 4 COLUMNAS AQUÍ --- */}
                    <div className="cita-actions" style={actionsGridStyles}>

                      {/* 1. Botón Mapa */}
                      <button
                        className="cita-icon-button"
                        onClick={() => handleOpenMaps(cita.caso)}
                        title="Abrir en Google Maps"
                        style={{ width: '100%' }} // Asegura que llene la celda de la grilla
                      >
                        📍
                      </button>

                      {/* 2. Botón Detalles (Siempre visible) */}
                      <Link
                        to={`/detalle-caso/${cita.caso.id}`}
                        className="cita-icon-button"
                        title="Ver Detalles"
                        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      >
                        ℹ️
                      </Link>

                      {/* 3. Botón Revisión (Condicional) */}
                      {(cita.caso.tipo !== 'levantamiento' && isCasoActivo) ? (
                        <Link
                          to={`/revision/${cita.caso.id}`}
                          className="cita-icon-button"
                          title="Iniciar Revisión"
                          style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                        >
                          📝
                        </Link>
                      ) : (
                        /* Rellenar espacio vacío si no aplica, para mantener alineación (opcional) */
                        isCasoActivo && <div />
                      )}

                      {/* 4. Slot Variable: Cotizar O Cerrar */}
                      {/* Priorizamos CERRAR si ya está listo, o COTIZAR si es el flujo */}
                      {isCasoActivo && (
                        <>
                          {/* Si quieres mostrar AMBOS (Cotizar y Cerrar) necesitaríamos 5 columnas. 
                                Asumiré que quieres el botón de COBRAR aquí. */}
                          <button
                            className="cita-icon-button"
                            style={{ backgroundColor: '#e8f5e9', borderColor: '#4caf50', width: '100%' }}
                            onClick={() => setCasoParaCerrar(cita.caso)}
                            title="Cobrar y Cerrar Caso"
                          >
                            💰
                          </button>
                        </>
                      )}

                      {/* Si prefieres mantener el botón de Cotizar disponible, 
                          puedes descomentar esto y ajustar el grid a 5 columnas o reemplazar otro icono */}
                      {/* {(isCasoActivo || cita.caso.tipo === 'alto_consumo') && (
                        <Link to="/cotizador" ... >⚡</Link>
                      )} 
                      */}

                    </div>
                  </>
                ) : (
                  <>
                    <strong>Cita (sin caso vinculado)</strong>
                    <p>{dayjs(cita.start_datetime).format('h:mm A')}</p>
                  </>
                )}
              </div>
            );
          })}

          {!isLoading && citas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>No hay citas programadas para este día.</p>
            </div>
          )}
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