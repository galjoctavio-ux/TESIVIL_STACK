import React, { useState, useEffect } from 'react';
import Modal from './Modal';

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: '15px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxSizing: 'border-box'
};

const selectStyle = {
  ...inputStyle
};

const buttonStyle = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  marginRight: '10px'
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: '#007bff',
  color: 'white'
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#6c757d',
  color: 'white'
};

const EditarCasoModal = ({ isOpen, onClose, caso, onSave }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    // Cuando el 'caso' prop cambia, reseteamos el estado del formulario.
    // Si no hay caso (ej. al cerrar), lo ponemos como objeto vacío.
    setFormData(caso || {});
  }, [caso]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen || !caso) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Editar Caso #{caso.id}</h2>
      <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
        <label>
          Nombre Cliente
          <input
            type="text"
            name="cliente_nombre"
            value={formData.cliente_nombre || ''}
            onChange={handleChange}
            style={inputStyle}
          />
        </label>
        <label>
          Dirección
          <input
            type="text"
            name="cliente_direccion"
            value={formData.cliente_direccion || ''}
            onChange={handleChange}
            style={inputStyle}
          />
        </label>
        <label>
          Teléfono
          <input
            type="text"
            name="cliente_telefono"
            value={formData.cliente_telefono || ''}
            onChange={handleChange}
            style={inputStyle}
          />
        </label>
        <label>
          Status
          <select
            name="status"
            value={formData.status || ''}
            onChange={handleChange}
            style={selectStyle}
          >
            <option value="pendiente">Pendiente</option>
            <option value="asignado">Asignado</option>
            <option value="completado">Completado</option>
            <option value="alto_consumo">Alto Consumo</option>
            <option value="levantamiento">Levantamiento</option>
          </select>
        </label>
        <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Técnico Asignado:</strong> {caso.tecnico?.nombre || 'Sin asignar'} (ID: {caso.tecnico_id || 'N/A'})
          <small style={{ display: 'block', color: '#6c757d' }}>La asignación de técnico se realiza desde otra interfaz.</small>
        </div>
        <div style={{ textAlign: 'right', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="submit" style={primaryButtonStyle}>
            Guardar Cambios
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditarCasoModal;
