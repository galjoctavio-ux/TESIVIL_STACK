import React, { useState, useEffect, useRef } from 'react';
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
            const start = dayjs(cita.start_datetime);
            const end = dayjs(cita.end_datetime);

            const top = (start.hour() + start.minute() / 60) * HOUR_HEIGHT;
            const durationInMinutes = end.diff(start, 'minute');
            const height = (durationInMinutes / 60) * HOUR_HEIGHT;

            // --- Lógica para las Clases CSS ---
            const cardClass = `cita-card card-${cita.caso_tipo || 'default'}`;


            return (
              <div
                key={cita.id}
                className={cardClass}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                }}
              >
                <strong>{cita.cliente_nombre || 'Cliente no asignado'}</strong>
                <p>{cita.servicio_nombre || 'Servicio no especificado'}</p>
                <div className="cita-direccion">{cita.caso_direccion || ''}</div>
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