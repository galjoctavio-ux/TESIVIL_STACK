import React from 'react';
import InputCard from '../ui/InputCard';

const Step3_Mediciones = ({ formData, updateFormData }) => {
  const handleChange = (e) => {
    updateFormData({ [e.target.name]: e.target.value });
  };

  const { tipo_servicio } = formData;
  const esMonofasico = tipo_servicio === 'Monofásico';
  const esBifasico = tipo_servicio === '2F+Neutro' || tipo_servicio === '2F+N con Paneles';
  const esTrifasico = tipo_servicio === 'Trifásico' || tipo_servicio === 'Trifásico con Paneles';
  const tienePaneles = tipo_servicio === '2F+N con Paneles' || tipo_servicio === 'Trifásico con Paneles';

  return (
    <div className="space-y-6">
      <InputCard
        label="Voltaje (Fase-Neutro)"
        name="voltaje_medido"
        value={formData.voltaje_medido || ''}
        onChange={handleChange}
        type="number"
        unit="V"
      />

      <div className="p-4 bg-blue-50 rounded-lg space-y-4">
        <h3 className="font-bold text-blue-800">Corriente de Red (Amperes)</h3>
        <InputCard
          label="Corriente Red F1"
          name="corriente_red_f1"
          value={formData.corriente_red_f1 || ''}
          onChange={handleChange}
          type="number"
          unit="A"
        />
        {(esBifasico || esTrifasico) && (
          <InputCard
            label="Corriente Red F2"
            name="corriente_red_f2"
            value={formData.corriente_red_f2 || ''}
            onChange={handleChange}
            type="number"
            unit="A"
          />
        )}
        {esTrifasico && (
          <InputCard
            label="Corriente Red F3"
            name="corriente_red_f3"
            value={formData.corriente_red_f3 || ''}
            onChange={handleChange}
            type="number"
            unit="A"
          />
        )}
        {(esMonofasico || esBifasico) && (
          <InputCard
            label="Corriente Red Neutro"
            name="corriente_red_n"
            value={formData.corriente_red_n || ''}
            onChange={handleChange}
            type="number"
            unit="A"
          />
        )}
      </div>

      {tienePaneles && (
        <div className="p-4 bg-green-50 rounded-lg space-y-4">
          <h3 className="font-bold text-green-800">Mediciones de Paneles Solares</h3>
          <InputCard
            label="Corriente Paneles F1"
            name="corriente_paneles_f1"
            value={formData.corriente_paneles_f1 || ''}
            onChange={handleChange}
            type="number"
            unit="A"
          />
          {(tipo_servicio === '2F+N con Paneles' || tipo_servicio === 'Trifásico con Paneles') && (
            <InputCard
              label="Corriente Paneles F2"
              name="corriente_paneles_f2"
              value={formData.corriente_paneles_f2 || ''}
              onChange={handleChange}
              type="number"
              unit="A"
            />
          )}
          {tipo_servicio === 'Trifásico con Paneles' && (
            <InputCard
              label="Corriente Paneles F3"
              name="corriente_paneles_f3"
              value={formData.corriente_paneles_f3 || ''}
              onChange={handleChange}
              type="number"
              unit="A"
            />
          )}
          <h4 className="font-semibold text-green-700 pt-2">Datos Generales de Paneles</h4>
          <InputCard
            label="Cantidad de Paneles"
            name="cantidad_paneles"
            value={formData.cantidad_paneles || ''}
            onChange={handleChange}
            type="number"
          />
          <InputCard
            label="Watts por Panel"
            name="watts_por_panel"
            value={formData.watts_por_panel || ''}
            onChange={handleChange}
            type="number"
            unit="W"
          />
          <InputCard
            label="Años de Antigüedad de Paneles"
            name="paneles_antiguedad_anos"
            value={formData.paneles_antiguedad_anos || ''}
            onChange={handleChange}
            type="number"
            unit="años"
          />
        </div>
      )}
    </div>
  );
};

export default Step3_Mediciones;
