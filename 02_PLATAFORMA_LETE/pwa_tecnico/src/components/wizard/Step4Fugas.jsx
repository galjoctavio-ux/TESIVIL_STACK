import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Button from './ui/Button';
import PhotoUpload from './ui/PhotoUpload';

const FugaCard = ({ fuga, onRemove }) => (
  <div style={styles.fugaCard}>
    <div>
      <p style={{ margin: 0, fontWeight: 'bold' }}>{fuga.ubicacion}</p>
      <p style={{ margin: '4px 0 0', color: '#6B7280' }}>Severidad: {fuga.severidad}</p>
    </div>
    {fuga.foto && <img src={fuga.foto} alt="Evidencia de fuga" style={styles.fugaImage} />}
    <button onClick={onRemove} style={styles.removeButton}><X size={16} /></button>
  </div>
);

const AddFugaForm = ({ onSave, onCancel }) => {
  const [fugaData, setFugaData] = useState({
    ubicacion: 'Baño Principal',
    severidad: 'Leve',
    foto: null,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFugaData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (file) => {
    setFugaData(prev => ({ ...prev, foto: file }));
  };

  const handleSave = () => {
    onSave({ ...fugaData, id: Date.now() });
  };

  return (
    <div style={styles.formContainer}>
      <h3 style={{ marginTop: 0 }}>Reportar Nueva Fuga</h3>

      <label>Ubicación</label>
      <select name="ubicacion" value={fugaData.ubicacion} onChange={handleChange} style={styles.select}>
        <option>Baño Principal</option>
        <option>Cocina</option>
        <option>Patio</option>
        <option>Otro</option>
      </select>

      <label>Severidad</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['Leve', 'Moderada', 'Crítica'].map(level => (
          <button
            key={level}
            type="button"
            onClick={() => setFugaData(prev => ({...prev, severidad: level}))}
            style={{
              ...styles.severityButton,
              backgroundColor: fugaData.severidad === level ? '#4F46E5' : '#E5E7EB',
              color: fugaData.severidad === level ? 'white' : '#111827',
            }}
          >
            {level}
          </button>
        ))}
      </div>

      <PhotoUpload onFileChange={handlePhotoChange} />

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <Button onClick={onCancel} variant="outline">Cancelar</Button>
        <Button onClick={handleSave} fullWidth>Guardar Fuga</Button>
      </div>
    </div>
  );
};

const Step4Fugas = ({ formData, setFormData }) => {
  const [isAdding, setIsAdding] = useState(false);

  const handleSaveFuga = (newFuga) => {
    setFormData(prev => ({
      ...prev,
      fugas: [...prev.fugas, newFuga],
    }));
    setIsAdding(false);
  };

  const handleRemoveFuga = (fugaId) => {
    setFormData(prev => ({
      ...prev,
      fugas: prev.fugas.filter(f => f.id !== fugaId)
    }));
  };

  return (
    <div>
      {formData.fugas.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {formData.fugas.map(fuga => (
            <FugaCard key={fuga.id} fuga={fuga} onRemove={() => handleRemoveFuga(fuga.id)} />
          ))}
        </div>
      )}

      {isAdding ? (
        <AddFugaForm onSave={handleSaveFuga} onCancel={() => setIsAdding(false)} />
      ) : (
        <button onClick={() => setIsAdding(true)} style={styles.addButton}>
          <Plus size={24} style={{ marginRight: '8px' }} />
          Reportar Nueva Fuga
        </button>
      )}
    </div>
  );
};

const styles = {
    addButton: {
        width: '100%',
        padding: '16px',
        backgroundColor: '#E5E7EB',
        border: '2px dashed #9CA3AF',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: 'bold',
        color: '#4B5563',
      },
      formContainer: {
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
      },
      select: {
        width: '100%',
        padding: '12px',
        border: '1px solid #D1D5DB',
        borderRadius: '8px',
        fontSize: '1rem',
        marginBottom: '16px',
      },
      severityButton: {
        flex: 1,
        padding: '12px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      },
      fugaCard: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        marginBottom: '8px',
        position: 'relative',
      },
      fugaImage: {
        width: '48px',
        height: '48px',
        borderRadius: '4px',
        objectFit: 'cover',
      },
      removeButton: {
        background: '#EF4444',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'absolute',
        top: '-8px',
        right: '-8px',
      },
};

export default Step4Fugas;