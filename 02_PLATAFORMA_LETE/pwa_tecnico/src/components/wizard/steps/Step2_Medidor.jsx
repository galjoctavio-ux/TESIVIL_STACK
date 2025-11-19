import React from 'react';
import BigToggle from '../ui/BigToggle';
import InputCard from '../ui/InputCard'; // Assuming this exists for text/number inputs
import SelectCard from '../ui/SelectCard'; // Assuming a reusable select component

const Step2_Medidor = ({ formData, updateFormData }) => {
  const handleChange = (field, value) => {
    updateFormData({ [field]: value });
  };

  const {
    tipo_servicio,
    sello_cfe,
    condicion_base_medidor,
    tornillos_flojos,
    capacidad_vs_calibre
  } = formData;

  return (
    <div className="space-y-6">
      <SelectCard
        label="Tipo de Servicio"
        name="tipo_servicio"
        value={tipo_servicio}
        onChange={(e) => handleChange('tipo_servicio', e.target.value)}
        options={[
          'Monofásico',
          '2F+Neutro',
          '2F+N con Paneles',
          'Trifásico',
          'Trifásico con Paneles',
        ]}
      />

      <BigToggle
        label="¿Cuenta con Sello CFE?"
        enabled={sello_cfe}
        onChange={(val) => handleChange('sello_cfe', val)}
      />

      {!sello_cfe && (
        <SelectCard
          label="Condición Base Medidor (Si NO hay sello)"
          name="condicion_base_medidor"
          value={condicion_base_medidor}
          onChange={(e) => handleChange('condicion_base_medidor', e.target.value)}
          options={['Bueno', 'Regular', 'Malo']}
        />
      )}

      <BigToggle
        label="¿Tornillos Flojos?"
        enabled={tornillos_flojos}
        onChange={(val) => handleChange('tornillos_flojos', val)}
      />

      {tornillos_flojos && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          <p className="font-bold">¡Atención! Aprieta los tornillos para asegurar una buena conexión y evitar fallas.</p>
        </div>
      )}

      <BigToggle
        label="¿Capacidad del Interruptor vs Calibre Correcto?"
        enabled={capacidad_vs_calibre}
        onChange={(val) => handleChange('capacidad_vs_calibre', val)}
      />

      {!capacidad_vs_calibre && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg">
          <p className="font-bold">¡PELIGRO! Riesgo de Incendio. El calibre del conductor no corresponde a la capacidad del interruptor.</p>
        </div>
      )}

      <InputCard
        label="Observaciones del Centro de Carga"
        name="observaciones_cc"
        value={formData.observaciones_cc || ''}
        onChange={(e) => handleChange('observaciones_cc', e.target.value)}
        placeholder="Ej: Se sobrecalienta, huele a quemado..."
        isTextarea
      />
    </div>
  );
};

export default Step2_Medidor;
