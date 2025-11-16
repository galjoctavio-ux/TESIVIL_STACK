import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import {
  obtenerTecnicos,
  checkAvailability,
  createCasoFromCotizacion,
  autorizarCotizacion,
} from '../apiService';

const AutorizarCotizacionModal = ({ cotizacion, onClose, onConfirm }) => {
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoId, setTecnicoId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarTecnicos = async () => {
      try {
        const res = await obtenerTecnicos();
        setTecnicos(res);
      } catch (error) {
        setError('Error al cargar los técnicos.');
      }
    };
    cargarTecnicos();
  }, []);

  const handleConfirm = async () => {
    if (!tecnicoId || !fechaInicio || !fechaFin) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    setError('');
    try {
      const availability = await checkAvailability(tecnicoId, fechaInicio, fechaFin);
      if (availability.hasConflict) {
        setError('El técnico ya tiene un evento en ese horario.');
        return;
      }

      await autorizarCotizacion(cotizacion.id);

      await createCasoFromCotizacion({
        cotizacionId: cotizacion.id,
        tecnico_id: tecnicoId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cliente_nombre: cotizacion.cliente_nombre,
        cliente_direccion: cotizacion.cliente_direccion,
      });

      onConfirm();
    } catch (error) {
      setError('Error al autorizar la cotización.');
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose}>
      <h2>Autorizar y Agendar Cotización #{cotizacion.id}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        <label>Asignar a Técnico</label>
        <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
          <option value="">Seleccionar técnico</option>
          {tecnicos.map((tecnico) => (
            <option key={tecnico.id} value={tecnico.id}>
              {tecnico.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Inicio de Proyecto</label>
        <input
          type="datetime-local"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />
      </div>
      <div>
        <label>Fin de Proyecto</label>
        <input
          type="datetime-local"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
        />
      </div>
      <button onClick={handleConfirm}>Confirmar</button>
    </Modal>
  );
};

export default AutorizarCotizacionModal;
