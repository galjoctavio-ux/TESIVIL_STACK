import React from 'react';
import InputCard from '../ui/InputCard';
import InfoCard from '../ui/InfoCard';

const Step1_Generales = ({ formData, updateFormData }) => {
  const { cliente_email, cliente_nombre, cliente_direccion } = formData;

  const handleEmailChange = (e) => {
    updateFormData({ cliente_email: e.target.value });
  };

  const hasClientInfo = cliente_nombre || cliente_direccion;

  return (
    <div className="space-y-6">
      {hasClientInfo && (
        <InfoCard>
          <div className="space-y-2">
            <h3 className="font-bold text-gray-800">Información del Cliente</h3>
            {cliente_nombre && <p className="text-sm text-gray-600"><strong>Nombre:</strong> {cliente_nombre}</p>}
            {cliente_direccion && <p className="text-sm text-gray-600"><strong>Dirección:</strong> {cliente_direccion}</p>}
          </div>
        </InfoCard>
      )}

      <InputCard
        id="client-email"
        label="Correo del Cliente (Obligatorio)"
        type="email"
        placeholder="ejemplo@correo.com"
        value={cliente_email || ''}
        onChange={handleEmailChange}
        required
      />
    </div>
  );
};

export default Step1_Generales;