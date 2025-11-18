import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../apiService'; // Corrected path
import InfoCard from './ui/InfoCard';
import Input from './ui/Input';
import { Mail } from 'lucide-react';

const Step1Generales = ({ formData, handleChange }) => {
  const { casoId } = useParams();
  const [caso, setCaso] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCasoData = async () => {
      try {
        const response = await api.get(`/casos/${casoId}`);
        setCaso(response.data);
      } catch (err) {
        setError('No se pudo cargar la información del caso.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCasoData();
  }, [casoId]);

  if (isLoading) {
    return <p>Cargando información del cliente...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  const clientData = {
    Nombre: caso?.cliente_nombre || 'N/A',
    Dirección: caso?.cliente_direccion || 'N/A',
    Teléfono: caso?.cliente_telefono || 'N/A',
  };

  return (
    <div>
      <InfoCard title="Datos del Cliente" data={clientData} />

      <h3 style={{ marginTop: '24px', marginBottom: '8px' }}>Información de Contacto</h3>
      <p style={{ color: '#6B7280', marginTop: 0, marginBottom: '16px' }}>
        Asegúrate de que el correo electrónico del cliente sea correcto para que reciba el reporte.
      </p>

      <Input
        icon={<Mail size={20} />}
        type="email"
        name="cliente_email"
        placeholder="ejemplo@correo.com"
        value={formData.cliente_email}
        onChange={handleChange}
        required
      />
    </div>
  );
};

export default Step1Generales;