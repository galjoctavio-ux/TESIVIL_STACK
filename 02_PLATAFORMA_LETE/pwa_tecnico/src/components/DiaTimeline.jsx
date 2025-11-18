import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { getAgendaPorDia } from '../apiService';

const HOUR_HEIGHT = 80; // 80px per hour

const timelineContainerStyles = {
  position: 'relative',
  overflowY: 'auto',
  height: 'calc(100vh - 70px)', // Adjust based on header height
};

const hourGridStyles = {
    paddingLeft: '60px', // Space for the time labels
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

const DiaTimeline = ({ date }) => {
  const [citas, setCitas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const timelineRef = useRef(null);

  useEffect(() => {
    const fetchAgenda = async () => {
      setIsLoading(true);
      try {
        const response = await getAgendaPorDia(date);
        setCitas(response.data || []);
      } catch (error) {
        console.error('Error fetching agenda:', error);
        setCitas([]); // Clear citas on error
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgenda();
  }, [date]);

  useEffect(() => {
    // Auto-scroll to current time if the view is for today
    if (dayjs(date).isSame(dayjs(), 'day') && timelineRef.current) {
      const currentHour = dayjs().hour();
      const hourEl = timelineRef.current.querySelector(`#hora-${currentHour}`);
      if (hourEl) {
        hourEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []); // Run only on initial mount

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
            // 1. La función que calcula el 'top' y 'height' sigue igual
            const start = dayjs(cita.start_datetime);
            const end = dayjs(cita.end_datetime);

            const top = (start.hour() + start.minute() / 60) * HOUR_HEIGHT;
            const durationInMinutes = end.diff(start, 'minute');
            const height = (durationInMinutes / 60) * HOUR_HEIGHT;

            const style = {
              top: `${top}px`,
              height: `${height}px`,
            };

            // 2. Definimos las clases dinámicas para el color
            const tipoCaso = cita.caso?.tipo || 'default'; // ej: 'alto_consumo'
            const cardClassName = `cita-card card-${tipoCaso}`; // -> "cita-card card-alto_consumo"

            return (
                <div
                    key={cita.id}
                    // This line applies the dynamic classes from AgendaStyles.css
                    // e.g., "cita-card card-alto_consumo"
                    className={cardClassName}
                    style={style}
                >
                    {/* 3. Renderizamos los detalles del caso si existen */}
                    {cita.caso ? (
                        <>
                            <strong>{cita.caso.cliente_nombre}</strong>
                            <p>{dayjs(cita.start_datetime).format('h:mm A')} - {dayjs(cita.end_datetime).format('h:mm A')}</p>
                            <div className="cita-actions"> {/* --- Botón de Mapa (Siempre visible) --- */} <button className="cita-icon-button" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cita.caso.cliente_direccion)}`, "_blank")} title="Abrir en Google Maps" > 📍 </button>
                                {/* --- Botón de Revisar (Lógica condicional) --- */} {(cita.caso.tipo !== 'levantamiento' && cita.caso.status !== 'completado') && (
                                <Link to={`/revision/${cita.caso.id}`} className="cita-icon-button" title="Iniciar Revisión" > 📝 </Link> )}
                                {/* --- Botón de Cotizar (Lógica condicional) --- */} {cita.caso.status !== 'completado' && (
                                <Link to="/cotizador" state={{ casoId: cita.caso.id, clienteNombre: cita.caso.cliente_nombre, clienteDireccion: cita.caso.cliente_direccion /* No pasamos clienteTelefono, tal como se especificó */ }} className="cita-icon-button" title="Crear Cotización" > ⚡ </Link> )}
                                {/* --- Botón de Detalles (Nuevo) --- */}
                                <Link to={`/detalle-caso/${cita.caso.id}`} className="cita-icon-button" title="Ver Detalles del Caso">
                                ℹ️
                                </Link>
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
    </div>
  );
};

export default DiaTimeline;