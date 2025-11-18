import React from 'react';
import { Mail } from 'lucide-react';
import InfoCard from '../ui/InfoCard';
import InputCard from '../ui/InputCard';

const Step1_Generales = ({ formData, setFormData }) => {
  // Mock data for demonstration purposes
  const clientData = {
    name: 'Juan Perez',
    address: 'Av. Siempre Viva 742',
  };

  const handleEmailChange = (e) => {
    setFormData({
      ...formData,
      email: e.target.value,
    });
  };

  // Simple email validation for demonstration
  const isEmailValid = () => {
    if (!formData.email) return true; // Not invalid if empty
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  };

  return (
    <div>
      <InfoCard title="Datos del Cliente">
        <p className="font-semibold text-lg">{clientData.name}</p>
        <p className="text-gray-500">{clientData.address}</p>
      </InfoCard>

      <InputCard
        label="Correo Electrónico del Cliente"
        icon={<Mail size={24} />}
        error={!isEmailValid() ? 'Por favor, introduce un correo válido.' : null}
      >
        <input
          type="email"
          placeholder="ejemplo@correo.com"
          className="w-full bg-transparent outline-none text-lg text-gray-800"
          value={formData.email || ''}
          onChange={handleEmailChange}
        />
      </InputCard>
    </div>
  );
};

export default Step1_Generales;
